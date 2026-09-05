/* =========================================================================
   SABLIER 3h33 — moteur autonome, canvas 2D, sans dépendance.
   Un canvas par instance ; options par attributs data-*.
   Repère interne fixe : 440 × 620, col au centre (y = 310).
   ========================================================================= */
(function(){
"use strict";

var RM = matchMedia("(prefers-reduced-motion: reduce)");
function calme(){ return document.documentElement.classList.contains("calme") || RM.matches; }

var W=440, H=620, CX=220, YCOL=310, YHAUT=54, YBAS=566, RAY=150, COL=9, DEMI=256;

/* demi-largeur du verre à l'ordonnée y */
function dl(y){
  var t = Math.abs(y-YCOL)/DEMI; if(t>1) t=1;
  /* courbe en S : taille fine près du col, épaules arrondies près du plateau.
     Le filet linéaire empêche la taille d'être exagérément pincée. */
  return COL + (RAY-COL)*(0.12*t + 0.88*(t*t*(3-2*t)));
}

/* tables d'aires cumulées, calculées une fois pour toutes.
   cumC : depuis le col vers le plateau ; cumP : depuis le plateau vers le col. */
var cumC = new Float64Array(DEMI+1), cumP = new Float64Array(DEMI+1);
for (var i=1;i<=DEMI;i++){
  cumC[i] = cumC[i-1] + 2*dl(YCOL + i - 0.5);
  cumP[i] = cumP[i-1] + 2*dl(YBAS - i + 0.5);
}
var VPLEIN = cumC[DEMI], VSABLE = VPLEIN*0.90;

function inverse(tab, A){
  if (A<=0) return 0; if (A>=tab[DEMI]) return DEMI;
  var lo=0, hi=DEMI;
  while (hi-lo>1){ var m=(lo+hi)>>1; if (tab[m]<A) lo=m; else hi=m; }
  var a=tab[lo], b=tab[hi];
  return lo + (b>a ? (A-a)/(b-a) : 0);
}
function borne(v,a,b){ return v<a?a:(v>b?b:v); }
function douceur(u){ return u<0.5 ? 4*u*u*u : 1-Math.pow(-2*u+2,3)/2; }

/* --- texture de grain : une tuile fabriquée une fois, répétée ensuite --- */
var tuile = null;
function faireTuile(){
  var t = document.createElement("canvas"); t.width = t.height = 72;
  var c = t.getContext("2d");
  c.fillStyle = "#e8a72c"; c.fillRect(0,0,72,72);
  for (var k=0;k<1100;k++){
    var x = (Math.random()*72)|0, y = (Math.random()*72)|0, r = Math.random();
    c.fillStyle = r<0.45 ? "rgba(150,92,6,.55)" : (r<0.78 ? "rgba(255,220,150,.6)" : "rgba(90,55,2,.35)");
    c.fillRect(x, y, 1, 1);
  }
  tuile = t;
}
faireTuile();

/* ====================== une instance ====================== */
function creer(cv){
  var o = {
    duree  : parseFloat(cv.dataset.duree)  || 24,   /* secondes d'écoulement */
    debit  : parseFloat(cv.dataset.debit)  || 62,   /* grains émis par seconde */
    attente: 1.0,                                   /* pause une fois vide */
    bascule: 1.4,                                   /* durée du retournement */
    chute  : 0.6                                    /* le sable se pose sur le col */
  };
  var ctx = cv.getContext("2d", {alpha:true});
  var sc = 1, monture = null, motif = null, largeurCss = 0;
  var p = 0, phase = "coule", tp = 0, ang = 0, assise = 1, accu = 0;
  var grains = [];
  var tas = {y:YBAS, hw:RAY, pic:0};
  var visible = true, tourne = false, dernier = 0;

  /* aide de maquette : ?sab=0.85 démarre le cycle où l'on veut, pour vérifier une image précise */
  var dep = /[?&]sab=([0-9.]+)/.exec(location.search);
  if (dep) p = borne(parseFloat(dep[1]), 0, 0.999);

  /* ---------- dimensionnement ---------- */
  function mesurer(){
    var l = cv.parentNode.clientWidth || cv.clientWidth || 300;
    if (Math.abs(l-largeurCss) < 0.5 && monture) return false;
    largeurCss = l;
    var dpr = Math.min(window.devicePixelRatio||1, 1.75);
    cv.width  = Math.max(2, Math.round(l*dpr));
    cv.height = Math.max(2, Math.round(l*dpr*H/W));
    sc = cv.width / W;
    motif = ctx.createPattern(tuile, "repeat");
    faireMonture();
    return true;
  }

  /* ---------- verre + monture : dessinés une fois dans un calque ---------- */
  function faireMonture(){
    monture = document.createElement("canvas");
    monture.width = cv.width; monture.height = cv.height;
    var m = monture.getContext("2d");
    m.setTransform(sc,0,0,sc,0,0);
    m.lineJoin = m.lineCap = "round";

    function paroi(signe){
      m.beginPath();
      for (var y=YHAUT; y<=YBAS; y+=4){ var x = CX + signe*dl(y); if (y===YHAUT) m.moveTo(x,y); else m.lineTo(x,y); }
      m.lineTo(CX + signe*dl(YBAS), YBAS);
    }
    /* épaisseur du verre : un trait large très pâle, un trait fin plus net */
    [[9,"rgba(31,111,245,.10)"],[2.1,"rgba(31,111,245,.50)"]].forEach(function(v){
      m.lineWidth = v[0]; m.strokeStyle = v[1];
      paroi(-1); m.stroke(); paroi(1); m.stroke();
    });

    /* reflet : un liseré clair qui épouse la paroi gauche, coupé au col */
    m.lineWidth = 3; m.strokeStyle = "rgba(255,255,255,.6)";
    [[YHAUT+18, YCOL-46],[YCOL+46, YBAS-18]].forEach(function(seg){
      m.beginPath();
      for (var y2=seg[0]; y2<=seg[1]; y2+=5) m.lineTo(CX - dl(y2) + 5.5, y2);
      m.stroke();
    });

    /* plateaux et montants, à l'encre : c'est la forme qui porte le signe */
    m.fillStyle = "#0f1524";
    function plateau(y, h){
      var x0 = CX-RAY-18, x1 = CX+RAY+18, r = 7;
      m.beginPath();
      m.moveTo(x0+r,y); m.lineTo(x1-r,y); m.quadraticCurveTo(x1,y,x1,y+r);
      m.lineTo(x1,y+h-r); m.quadraticCurveTo(x1,y+h,x1-r,y+h);
      m.lineTo(x0+r,y+h); m.quadraticCurveTo(x0,y+h,x0,y+h-r);
      m.lineTo(x0,y+r); m.quadraticCurveTo(x0,y,x0+r,y); m.fill();
    }
    plateau(YHAUT-17, 15); plateau(YBAS+2, 15);
    m.strokeStyle = "rgba(15,21,36,.62)"; m.lineWidth = 5;
    [-1,1].forEach(function(s){
      m.beginPath(); m.moveTo(CX + s*(RAY+9), YHAUT-4); m.lineTo(CX + s*(RAY+9), YBAS+4); m.stroke();
    });
    /* collier au col : deux petites viroles à l'encre, la pièce d'horlogerie du sablier */
    m.strokeStyle = "rgba(15,21,36,.8)"; m.lineWidth = 3.4; m.lineCap = "butt";
    [-1,1].forEach(function(s){
      m.beginPath();
      m.moveTo(CX + s*(COL+11), YCOL-3.5); m.lineTo(CX + s*(COL+0.5), YCOL-3.5);
      m.moveTo(CX + s*(COL+0.5), YCOL+3.5); m.lineTo(CX + s*(COL+11), YCOL+3.5);
      m.stroke();
    });
    m.lineCap = "round";
  }

  /* ---------- géométrie du sable ---------- */
  /* Trace une bande de sable entre deux ordonnées, avec une surface
     creusée (forme = -1), bombée (forme = +1) ou plate (0). */
  function bande(yh, yb, forme, amp){
    if (yb - yh < 0.6) return false;
    var hwh = dl(yh);
    ctx.beginPath();
    var y;
    for (y=yh; y<yb; y+=7) ctx.lineTo(CX - dl(y), y);
    ctx.lineTo(CX - dl(yb), yb);
    ctx.lineTo(CX + dl(yb), yb);
    for (y=yb; y>yh; y-=7) ctx.lineTo(CX + dl(y), y);
    ctx.lineTo(CX + hwh, yh);
    if (forme === 0 || amp < 0.4){ ctx.lineTo(CX - hwh, yh); }
    else {
      for (var k=0;k<=18;k++){
        var u = 1 - 2*k/18;                    /* +1 (droite) → -1 (gauche) */
        var x = CX + hwh*u;
        var d = Math.abs(u);
        var yy = forme < 0 ? yh + amp*(1-Math.pow(d,1.8))    /* entonnoir */
                           : yh - amp*(1-d);                  /* cône */
        ctx.lineTo(x, yy);
      }
    }
    ctx.closePath();
    return true;
  }

  function remplirSable(y0, y1){
    ctx.save(); ctx.clip();
    ctx.fillStyle = motif;
    ctx.fillRect(CX-RAY-4, y0-60, 2*RAY+8, (y1-y0)+120);
    ctx.restore();
    ctx.lineWidth = 1.1; ctx.strokeStyle = "rgba(96,58,3,.45)"; ctx.stroke();
  }

  function majTas(){
    var B = p*VSABLE;
    if (B < 1){ tas.y = YBAS; tas.hw = dl(YBAS); tas.pic = 0; return; }
    var k = inverse(cumP, B);                      /* hauteur si la surface était plate */
    var y = YBAS - k, hwl = dl(y);
    /* talus naturel : pente limitée, cône écrêté quand l'ampoule se remplit,
       et jamais plus haut que ce que le tas contient réellement */
    var pic = Math.min(46, hwl*0.55, k*2) * borne((1-p)/0.10,0,1);
    tas.y = Math.min(YBAS-0.8, y + pic*0.42); tas.hw = hwl; tas.pic = pic;
  }
  function solTas(x){
    var d = Math.abs(x-CX)/Math.max(1,tas.hw);
    return tas.y - tas.pic*Math.max(0, 1-d);
  }

  /* ---------- grains ---------- */
  function emettre(){
    grains.push({x: CX + (Math.random()-0.5)*COL*1.25, y: YCOL+2,
                 vx: (Math.random()-0.5)*9, vy: 25+Math.random()*45,
                 t: Math.random()<0.28 ? 2 : 1, m:0, vie:0, vr:0});
  }
  function physique(dt){
    for (var i=grains.length-1;i>=0;i--){
      var g = grains[i];
      if (g.m === 0){
        g.vy += 900*dt; g.y += g.vy*dt; g.x += g.vx*dt;
        var sol = solTas(g.x);
        if (g.y >= sol){
          if (Math.random() < 0.34){ g.m=1; g.vie = 0.22+Math.random()*0.3;
            g.vr = (g.x>=CX?1:-1)*(45+Math.random()*95); g.y = sol-0.5; }
          else grains.splice(i,1);
        } else if (g.y > YBAS) grains.splice(i,1);
      } else {
        g.vie -= dt; g.x += g.vr*dt; g.y = solTas(g.x)-0.5;
        if (g.vie<=0 || Math.abs(g.x-CX) > tas.hw*0.94) grains.splice(i,1);
      }
    }
  }

  /* ---------- une image ---------- */
  function rendre(){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.setTransform(sc,0,0,sc,0,0);
    if (ang){
      /* pendant le retournement, l'objet s'inscrit dans le cadre : il recule un peu
         quand il est en travers, exactement comme une main qui soulève et tourne. */
      var a=170, b=278, ca=Math.abs(Math.cos(ang)), sa=Math.abs(Math.sin(ang));
      var z = Math.min(1, Math.min((W/2)/(a*ca+b*sa), (H/2)/(a*sa+b*ca)) * 0.98);
      ctx.translate(CX,YCOL); ctx.rotate(ang); ctx.scale(z,z); ctx.translate(-CX,-YCOL);
    }

    /* ampoule du haut : entre « posé sur le plafond » et « posé sur le col » */
    var A = (1-p)*VSABLE;
    if (A > 2){
      var yhCol = YCOL - inverse(cumC, A), ybCol = YCOL;
      var yhPla = YHAUT,                   ybPla = YHAUT + inverse(cumP, A);
      var a  = assise;
      var yh = yhPla + (yhCol-yhPla)*a, yb = ybPla + (ybCol-ybPla)*a;
      var creux = Math.min(30, dl(yh)*0.40) * borne(p/0.07,0,1) * a;
      if (bande(yh - creux*0.45, yb, -1, creux)) remplirSable(yh-creux, yb);
    }
    /* ampoule du bas */
    if (p*VSABLE > 2 && bande(tas.y, YBAS, 1, tas.pic)) remplirSable(tas.y-tas.pic, YBAS);

    /* filet de grains */
    if (grains.length){
      ctx.fillStyle = "#8a5606";
      for (var i=0;i<grains.length;i++){ var g=grains[i]; ctx.fillRect(g.x-g.t/2, g.y-g.t/2, g.t, g.t); }
      ctx.fillStyle = "rgba(255,214,138,.9)";
      for (var j=0;j<grains.length;j+=3){ var h=grains[j]; ctx.fillRect(h.x-0.5, h.y-1.5, 1, 1); }
    }
    ctx.drawImage(monture, 0, 0, W, H);
  }

  /* ---------- horloge ---------- */
  function pas(dt){
    if (phase === "coule"){
      p += dt/o.duree;
      accu += dt*o.debit;
      while (accu >= 1){ accu -= 1; if (grains.length < 160) emettre(); }
      if (p >= 1){ p = 1; phase = "attente"; tp = 0; grains.length = 0; }
    } else if (phase === "attente"){
      tp += dt; if (tp >= o.attente){ phase = "bascule"; tp = 0; }
    } else if (phase === "bascule"){
      tp += dt;
      var u = Math.min(1, tp/o.bascule);
      ang = Math.PI*douceur(u);
      if (u >= 1){ ang = 0; p = 0; assise = 0; phase = "chute"; tp = 0; }
    } else { /* chute : le bloc se décolle du plafond et se pose sur le col */
      tp += dt;
      var v = Math.min(1, tp/o.chute);
      assise = v*v;                              /* accélère comme une chute */
      if (v >= 1){ assise = 1; phase = "coule"; accu = 0; }
    }
    majTas();
    if (phase === "coule") physique(dt);
  }

  /* ---------- image figée (calme / mouvement réduit) ---------- */
  function figer(){
    p = 0.45; ang = 0; assise = 1; phase = "coule";
    majTas();
    grains.length = 0;
    for (var y=YCOL+7; y<solTas(CX)-5; y+=9)
      grains.push({x: CX + Math.sin(y*0.33)*2.6, y:y, t: (y%18<9)?2:1, m:0});
    mesurer(); rendre();
    grains.length = 0;
  }

  function boucle(t){
    if (!tourne) return;
    if (!dernier) dernier = t;
    var dt = Math.min(0.05, (t-dernier)/1000); dernier = t;
    mesurer();
    pas(dt); rendre();
    compteur(dt, grains.length);
    requestAnimationFrame(boucle);
  }
  function demarrer(){
    if (tourne || calme() || !visible || document.hidden) return;
    tourne = true; dernier = 0; requestAnimationFrame(boucle);
  }
  function arreter(){ tourne = false; }

  mesurer(); majTas();
  if (calme()) figer(); else { rendre(); }

  if (window.IntersectionObserver){
    new IntersectionObserver(function(es){
      visible = es[0].isIntersecting;
      if (visible) demarrer(); else arreter();
    }, {rootMargin:"120px"}).observe(cv);
  } else { visible = true; demarrer(); }

  if (window.ResizeObserver) new ResizeObserver(function(){ if (mesurer() && !tourne) (calme()?figer():rendre()); }).observe(cv.parentNode);
  else addEventListener("resize", function(){ if (mesurer() && !tourne) (calme()?figer():rendre()); });

  return { demarrer:demarrer, arreter:arreter, figer:figer,
           avancer:function(dt){ pas(dt); rendre(); },   /* une image à la main : utile pour mesurer */
           relancer:function(){ if (calme()) { arreter(); figer(); } else demarrer(); } };
}

/* ---------- amorçage ---------- */
var instances = [];
function amorcer(){
  var liste = document.querySelectorAll("canvas[data-sablier]");
  for (var i=0;i<liste.length;i++) instances.push(creer(liste[i]));
  window.__sabliers = instances;
}
document.addEventListener("visibilitychange", function(){
  for (var i=0;i<instances.length;i++){ if (document.hidden) instances[i].arreter(); else instances[i].relancer(); }
});
RM.addEventListener && RM.addEventListener("change", function(){ for (var i=0;i<instances.length;i++) instances[i].relancer(); });

/* compteur d'images/s : une seule mesure partagée, mise à jour 2 fois par seconde */
var accT=0, accN=0, dernierNb=0;
function compteur(dt, nb){ accT+=dt; accN++; dernierNb=nb; }
setInterval(function(){
  var f = document.getElementById("fps"), n = document.getElementById("nb"), s = document.getElementById("nsab");
  if (!f) return;
  f.textContent = accT>0 ? Math.round(accN/accT) : "0";
  n.textContent = dernierNb; s.textContent = instances.length;
  accT=0; accN=0;
}, 700);

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", amorcer); else amorcer();
})();
