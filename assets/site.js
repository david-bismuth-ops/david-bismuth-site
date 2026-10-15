/* David Bismuth — comportements du site (aucune dépendance). */
(function () {
  "use strict";

  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var play = function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); };

  /* ---------- Échelle 1920 calculée sans la barre de défilement (comme Readymag) ---------- */

  var setScale = function () {
    if (root.clientWidth >= 768) root.style.setProperty("--u", root.clientWidth / 1920 + "px");
    else root.style.removeProperty("--u");
  };
  setScale();
  window.addEventListener("resize", setScale);

  /* ---------- Aperçus vidéo : lecture seulement quand ils sont à l'écran ----------
     Ils jouent même avec « Réduire les animations » : ce sont des films, le contenu du site. */

  var previews = Array.prototype.slice.call(document.querySelectorAll("video[data-preview]"));
  if (previews.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.preload !== "auto") v.preload = "auto";
          play(v);
        } else {
          v.pause();
        }
      });
    }, { rootMargin: "200px 0px" });
    previews.forEach(function (v) {
      v.muted = true; // requis pour l'autoplay
      io.observe(v);
    });
  }

  /* ---------- Son au survol : « sound on » fait entendre la musique du film survolé ---------- */

  var soundBtn = document.querySelector(".sound-toggle");
  var sliderApi = null;
  var soundOn = false;
  // Les fondus passent par Web Audio : une rampe de gain continue, comme un fader.
  // (Changer « volume » par petites marches produisait un léger crépitement.)
  var audioCtxNode = null, gains = new WeakMap(), muteTimers = new WeakMap();
  var audioCtx = function () {
    var C = window.AudioContext || window.webkitAudioContext;
    if (!audioCtxNode && C) audioCtxNode = new C();
    if (audioCtxNode && audioCtxNode.state === "suspended") audioCtxNode.resume();
    return audioCtxNode;
  };
  // Le moteur audio ne démarre qu'après un geste : le premier clic ou la première touche le réveille
  ["pointerdown", "keydown"].forEach(function (ev) {
    document.addEventListener(ev, function () { if (audioCtxNode && audioCtxNode.state === "suspended") audioCtxNode.resume(); }, { passive: true });
  });
  var gainOf = function (v) {
    var g = gains.get(v);
    if (!g && audioCtx()) {
      try {
        g = audioCtxNode.createGain();
        g.gain.value = 0;
        audioCtxNode.createMediaElementSource(v).connect(g);
        g.connect(audioCtxNode.destination);
        gains.set(v, g);
      } catch (e) { g = null; }
    }
    return g;
  };
  var fadeTo = function (v, target, ms) {
    var g = gainOf(v);
    clearTimeout(muteTimers.get(v));
    if (target > 0) {
      v.volume = 1;
      if (v.muted) v.muted = false;
      if (v.paused) play(v);
    }
    if (!g) { v.volume = target; if (target === 0) v.muted = true; return; }
    var t = audioCtxNode.currentTime, p = g.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    // courbe douce : la rampe linéaire de gain sonne naturelle sur ces durées
    p.linearRampToValueAtTime(target, t + ms / 1000);
    if (target === 0) {
      muteTimers.set(v, setTimeout(function () { v.muted = true; }, ms + 60));
    }
  };
  var setSound = function (on) {
    soundOn = on;
    if (!soundBtn) return;
    soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
    soundBtn.querySelector(".sound-state").textContent = on ? "sound on" : "sound off";
    if (!on) previews.forEach(function (v) { if (!v.muted) fadeTo(v, 0, 200); });
    if (sliderApi) sliderApi.sound(on);
  };
  var hearIn = function (v) {
    if (!soundOn || !v) return;
    fadeTo(v, 1, 350);
    // Si le navigateur refuse le son sans clic, on repasse en muet sans bloquer la vidéo
    setTimeout(function () {
      if (v.paused && !v.muted) { v.muted = true; play(v); setSound(false); }
    }, 120);
  };
  var hearOut = function (v) { if (v && !v.muted) fadeTo(v, 0, 300); };
  if (soundBtn) {
    soundBtn.addEventListener("click", function () {
      audioCtx();
      setSound(!soundOn);
      store.set("db-sound", soundOn ? "1" : "0");
    });
    if (store.get("db-sound") === "1") setSound(true);
  }

  /* ---------- Lecture plein écran des films (media/*-full.mp4) ---------- */

  var lb = document.querySelector(".lightbox");
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".tile[data-film], .slide[data-film]"));
  var openFilm = null;
  if (lb) {
    var frame = lb.querySelector(".lb-frame");
    var caption = lb.querySelector(".lb-caption");
    var titleBox = lb.querySelector(".lb-title");
    var roleBox = lb.querySelector(".lb-role");
    var countBox = lb.querySelector(".lb-count");
    var lastTile = null;
    var index = 0;
    var pad = function (n) { return String(n).padStart(2, "0"); };

    // Fond « ambiant » : le film, réduit et très flouté, derrière le lecteur
    var ambient = document.createElement("canvas");
    ambient.className = "lb-ambient";
    ambient.width = 48;
    ambient.height = 27;
    ambient.setAttribute("aria-hidden", "true");
    lb.insertBefore(ambient, lb.firstChild);
    var actx = ambient.getContext("2d");
    var ambientTimer = 0;
    var paintAmbient = function () {
      var v = frame.querySelector("video");
      if (!v || v.readyState < 2) return;
      try {
        actx.drawImage(v, 0, 0, ambient.width, ambient.height);
        ambient.classList.add("is-on");
      } catch (e) { /* image non lisible : on garde le gris */ }
    };

    var show = function (i) {
      index = (i + tiles.length) % tiles.length;
      var tile = tiles[index];
      lastTile = tile;
      frame.textContent = "";
      ambient.classList.remove("is-on");
      frame.classList.toggle("is-portrait", tile.hasAttribute("data-portrait"));
      var media = document.createElement("video");
      media.src = tile.dataset.film;
      media.controls = true;
      media.autoplay = true;
      media.playsInline = true;
      var poster = tile.querySelector("video");
      if (poster && poster.poster) media.poster = poster.poster;
      media.title = tile.getAttribute("aria-label") || "Film";
      frame.appendChild(media);
      titleBox.textContent = tile.getAttribute("aria-label") || "";
      roleBox.textContent = tile.dataset.role || "";
      caption.textContent = tile.dataset.credit || "";
      // Lien vers la page du projet (si elle existe)
      var pageLink = lb.querySelector(".lb-page");
      if (!pageLink) {
        pageLink = document.createElement("a");
        pageLink.className = "lb-page ul";
        pageLink.textContent = "project page →";
        lb.querySelector(".lb-foot").appendChild(pageLink);
      }
      pageLink.hidden = !tile.dataset.page;
      if (tile.dataset.page) pageLink.href = tile.dataset.page;
      countBox.textContent = tiles.length > 1 ? pad(index + 1) + " / " + pad(tiles.length) : "";
      lb.classList.toggle("is-single", tiles.length < 2);
      // Showreel : le nom du film en cours s'affiche au fil de la lecture
      if (tile.dataset.chapters) {
        var chapters = JSON.parse(tile.dataset.chapters);
        roleBox.textContent = chapters[0][1];
        media.addEventListener("timeupdate", function () {
          var name = "";
          chapters.forEach(function (c) { if (media.currentTime >= c[0]) name = c[1]; });
          if (roleBox.textContent !== name) roleBox.textContent = name;
        });
      }
    };

    var open = function (tile) {
      show(tiles.indexOf(tile));
      if (!lb.open) lb.showModal();
      root.style.overflow = "hidden";
      clearInterval(ambientTimer);
      ambientTimer = setInterval(paintAmbient, 140);
      // Un seul son à la fois : toutes les autres vidéos et le lecteur audio se mettent en pause
      document.querySelectorAll("video").forEach(function (v) { if (!lb.contains(v)) { v.muted = true; v.pause(); } });
      document.querySelectorAll("audio").forEach(function (a) { a.pause(); });
    };
    openFilm = open;

    var close = function () { if (lb.open) lb.close(); };

    lb.addEventListener("close", function () {
      clearInterval(ambientTimer);
      ambient.classList.remove("is-on");
      frame.textContent = ""; // coupe le son immédiatement
      root.style.overflow = "";
      if (lastTile && lastTile.offsetParent) lastTile.focus({ preventScroll: true });
      previews.forEach(function (v) {
        var r = v.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) play(v);
      });
      if (sliderApi) sliderApi.resume();
    });
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1); });
    lb.querySelector(".lb-next").addEventListener("click", function () { show(index + 1); });
    lb.addEventListener("keydown", function (e) {
      if (e.target.tagName === "VIDEO") return; // les flèches servent alors à avancer dans le film
      if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
    });
    // Un clic hors du film ferme la lecture
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target === ambient) close(); });

    // Liens texte « ▶ watch… » : data-play = rang de la tuile à ouvrir
    document.querySelectorAll("[data-play]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        var tile = tiles[+link.dataset.play];
        if (!tile || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        open(tile);
      });
    });

    tiles.forEach(function (tile) {
      tile.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return; // ouvrir dans un onglet reste possible
        e.preventDefault();
        open(tile);
      });
      var v = tile.querySelector("video[data-preview]");
      tile.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") hearIn(v); });
      tile.addEventListener("pointerleave", function () { hearOut(v); });
    });
  }

  /* ---------- Accueil : un projet par écran ; l'écran remonte comme un rideau ---------- */

  var slider = document.querySelector(".slider");
  if (slider) {
    var slides = Array.prototype.slice.call(slider.querySelectorAll(".slide"));
    var curSlide = 0, busy = false;
    var pad2 = function (n) { return String(n).padStart(2, "0"); };
    var nowEl = slider.querySelector(".sc-now");
    slider.querySelector(".sc-total").textContent = pad2(slides.length);
    var vidOf = function (sl) { return sl.querySelector("video"); };
    var loadSlide = function (sl) {
      var v = vidOf(sl);
      if (!v.getAttribute("src")) { v.src = v.dataset.src; v.preload = "auto"; }
      return v;
    };
    var EASE = "cubic-bezier(0.76, 0, 0.24, 1)", OUT = "cubic-bezier(0.22, 1, 0.36, 1)", DUR = 1100;
    var titleIn = function (sl, delay) {
      sl.querySelectorAll(".slide-title span").forEach(function (sp, i) {
        sp.animate([{ transform: "translateY(110%)" }, { transform: "translateY(0)" }],
          { duration: 900, delay: delay + i * 90, easing: OUT, fill: "backwards" });
      });
    };
    var activate = function (sl) {
      sl.classList.add("is-active");
      var v = loadSlide(sl);
      v.muted = true;
      play(v);
      // Relance si la lecture n'a pas pu démarrer tout de suite (vidéo pas encore prête)
      v.addEventListener("canplay", function () {
        if (sl.classList.contains("is-active") && v.paused && !(lb && lb.open)) play(v);
      }, { once: true });
      hearIn(v);
      // Le suivant et le précédent se préparent, pour qu'aucun écran n'arrive vide
      var i = slides.indexOf(sl);
      loadSlide(slides[(i + 1) % slides.length]);
      loadSlide(slides[(i - 1 + slides.length) % slides.length]);
    };
    // Liste de tous les écrans : un clic y mène directement
    var listEl = slider.querySelector(".home-list");
    var listBtns = slides.map(function (sl, i) {
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button";
      b.textContent = sl.getAttribute("aria-label");
      b.addEventListener("click", function () { goTo(i); });
      li.appendChild(b);
      if (listEl) listEl.appendChild(li);
      return b;
    });
    var markCurrent = function () {
      listBtns.forEach(function (b, i) { b.setAttribute("aria-current", i === curSlide ? "true" : "false"); });
    };
    // axis « x » : glissement latéral (balayage gauche / droite) ; sinon rideau vertical
    var go = function (dir, target, axis) {
      var T = axis === "x" ? "translateX" : "translateY";
      if (busy || (lb && lb.open)) return;
      busy = true;
      var from = slides[curSlide];
      curSlide = target !== undefined ? target : (curSlide + dir + slides.length) % slides.length;
      var to = slides[curSlide];
      nowEl.textContent = pad2(curSlide + 1);
      markCurrent();
      activate(to);
      var vFrom = vidOf(from);
      if (!vFrom.muted) fadeTo(vFrom, 0, 700);
      var mFrom = from.querySelector(".slide-media"), mTo = to.querySelector(".slide-media"), lead;
      // fill « forwards » : chaque élément reste à sa position finale jusqu'au nettoyage,
      // sinon l'écran sortant réapparaît une image avant d'être masqué (petit saut visible)
      var anims = [];
      var anim = function (el, frames, opts) {
        opts.fill = "forwards";
        var a = el.animate(frames, opts);
        anims.push(a);
        return a;
      };
      if (dir > 0) {
        // L'écran actuel monte et découvre le suivant, qui se pose en douceur
        from.classList.add("is-moving");
        lead = anim(from, [{ transform: T + "(0)" }, { transform: T + "(-100%)" }], { duration: DUR, easing: EASE });
        anim(mFrom, [{ transform: T + "(0)" }, { transform: T + "(45%)" }], { duration: DUR, easing: EASE });
        anim(mTo, [{ transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: DUR + 300, easing: OUT });
      } else {
        // En remontant, l'écran précédent redescend par-dessus
        to.classList.add("is-moving");
        lead = anim(to, [{ transform: T + "(-100%)" }, { transform: T + "(0)" }], { duration: DUR, easing: EASE });
        anim(mTo, [{ transform: T + "(45%)" }, { transform: T + "(0)" }], { duration: DUR, easing: EASE });
        anim(mFrom, [{ transform: "scale(1)" }, { transform: "scale(1.08)" }], { duration: DUR, easing: EASE });
      }
      from.querySelectorAll(".slide-title span").forEach(function (sp) {
        anim(sp, [{ transform: "translateY(0)" }, { transform: "translateY(-110%)" }],
          { duration: 450, easing: "cubic-bezier(0.55, 0, 1, 0.45)" });
      });
      titleIn(to, 420);
      lead.finished.then(function () {
        // Le rideau est passé : l'écran sortant est masqué (il reste figé hors champ)
        from.classList.remove("is-active", "is-moving");
        to.classList.remove("is-moving");
        vFrom.pause();
        vFrom.muted = true;
      });
      Promise.all(anims.map(function (a) { return a.finished; })).then(function () {
        // Tout est fini : les positions finales sont les positions normales, on libère
        anims.forEach(function (a) { a.cancel(); });
        busy = false;
      });
    };

    var goTo = function (i) { if (i !== curSlide) go(i > curSlide ? 1 : -1, i); };

    // Molette ou pavé tactile : un projet par geste (l'inertie ne fait pas sauter d'écrans)
    var lastWheel = 0;
    window.addEventListener("wheel", function (e) {
      if (lb && lb.open) return;
      var now = performance.now(), fresh = now - lastWheel > 260;
      lastWheel = now;
      if (Math.abs(e.deltaY) < 4 || !fresh) return;
      go(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
    document.addEventListener("keydown", function (e) {
      if (lb && lb.open) return;
      if (["ArrowDown", "PageDown", " "].indexOf(e.key) > -1) { e.preventDefault(); go(1); }
      if (["ArrowUp", "PageUp"].indexOf(e.key) > -1) { e.preventDefault(); go(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(1, undefined, "x"); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1, undefined, "x"); }
    });
    // Au doigt : glisser vers le haut / la gauche = projet suivant, vers le bas / la droite = précédent
    var x0 = null, y0 = null;
    slider.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    slider.addEventListener("touchend", function (e) {
      if (y0 === null) return;
      var dx = x0 - e.changedTouches[0].clientX, dy = y0 - e.changedTouches[0].clientY;
      x0 = y0 = null;
      if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > 40) go(dx > 0 ? 1 : -1, undefined, "x"); }
      else if (Math.abs(dy) > 40) go(dy > 0 ? 1 : -1);
    }, { passive: true });
    slider.querySelector(".slider-prev").addEventListener("click", function () { go(-1); });
    slider.querySelector(".slider-next").addEventListener("click", function () { go(1); });

    document.addEventListener("visibilitychange", function () {
      var v = vidOf(slides[curSlide]);
      if (!document.hidden && v.paused && !(lb && lb.open)) play(v);
    });

    sliderApi = {
      sound: function (on) { var v = vidOf(slides[curSlide]); if (on) hearIn(v); else hearOut(v); },
      resume: function () { var v = vidOf(slides[curSlide]); v.muted = true; play(v); hearIn(v); }
    };
    titleIn(slides[0], 250);
    activate(slides[0]);
    markCurrent();
  }

  /* ---------- Vue « index » : la liste des projets, le film flotte près du curseur ---------- */

  var indexList = document.querySelector(".work-index");
  var floatBox = null, floatVideo = null;
  if (indexList && openFilm) {
    var main = indexList.closest("main");
    var projects = tiles.filter(function (t) { return !t.classList.contains("tile-reel"); });
    var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    projects.forEach(function (tile, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.innerHTML = '<span class="ix-num"></span><span class="ix-title"></span><span class="ix-role"></span>';
      b.querySelector(".ix-num").textContent = String(i + 1).padStart(2, "0");
      b.querySelector(".ix-title").textContent = tile.getAttribute("aria-label");
      b.querySelector(".ix-role").textContent = tile.dataset.role || "";
      b.addEventListener("click", function () { openFilm(tile); });
      li.appendChild(b);
      indexList.appendChild(li);
      if (!finePointer) return;
      b.addEventListener("pointerenter", function (e) {
        var src = tile.querySelector("video[data-preview]");
        if (!floatBox.classList.contains("is-on")) placeFloat(e, true);
        if (floatVideo.getAttribute("src") !== src.getAttribute("src")) {
          floatVideo.src = src.getAttribute("src");
          floatVideo.poster = src.poster;
        }
        floatVideo.muted = true;
        play(floatVideo);
        hearIn(floatVideo);
        floatBox.classList.add("is-on");
      });
      b.addEventListener("pointerleave", function () {
        hearOut(floatVideo);
        floatBox.classList.remove("is-on");
      });
    });

    if (finePointer) {
      floatBox = document.createElement("div");
      floatBox.className = "index-float";
      floatBox.setAttribute("aria-hidden", "true");
      floatVideo = document.createElement("video");
      floatVideo.muted = true;
      floatVideo.loop = true;
      floatVideo.playsInline = true;
      floatBox.appendChild(floatVideo);
      // Le cadre flottant prend le format du film (vertical ou horizontal)
      floatVideo.addEventListener("loadedmetadata", function () {
        floatBox.classList.toggle("is-portrait", floatVideo.videoHeight > floatVideo.videoWidth);
      });
      document.body.appendChild(floatBox);
      var fx = 0, fy = 0, gx = 0, gy = 0, fraf = 0;
      var glide = function () {
        fx += (gx - fx) * 0.18;
        fy += (gy - fy) * 0.18;
        floatBox.style.transform = "translate3d(" + fx + "px," + fy + "px,0)";
        fraf = Math.abs(gx - fx) + Math.abs(gy - fy) > 0.5 ? requestAnimationFrame(glide) : 0;
      };
      var placeFloat = function (e, jump) {
        var w = floatBox.offsetWidth, h = floatBox.offsetHeight;
        gx = Math.min(e.clientX + 28, innerWidth - w - 12);
        gy = Math.max(12, Math.min(e.clientY - h / 2, innerHeight - h - 12));
        if (jump) { fx = gx; fy = gy; floatBox.style.transform = "translate3d(" + fx + "px," + fy + "px,0)"; }
        else if (!fraf) fraf = requestAnimationFrame(glide);
      };
      indexList.addEventListener("pointermove", function (e) { placeFloat(e, false); });
      indexList.addEventListener("pointerleave", function () {
        floatBox.classList.remove("is-on");
        floatVideo.pause();
      });
    }

    var setView = function (view) {
      var isIndex = view === "index";
      main.classList.toggle("is-index", isIndex);
      indexList.hidden = !isIndex;
      document.querySelectorAll(".view-switch button").forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.view === view ? "true" : "false");
      });
      store.set("db-view", view);
    };
    document.querySelectorAll(".view-switch button").forEach(function (b) {
      b.addEventListener("click", function () { setView(b.dataset.view); });
    });
    if (store.get("db-view") === "index") setView("index");
  }

  /* ---------- Curseur « play » sur les tuiles (souris uniquement) ---------- */

  if (tiles.length && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var cursor = document.createElement("div");
    cursor.className = "play-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.textContent = "play";
    document.body.appendChild(cursor);
    root.classList.add("has-play-cursor");
    var cx = 0, cy = 0, tx = 0, ty = 0, raf = 0;
    var follow = function () {
      cx += (tx - cx) * 0.25;
      cy += (ty - cy) * 0.25;
      cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5 ? requestAnimationFrame(follow) : 0;
    };
    tiles.forEach(function (tile) {
      tile.addEventListener("pointerenter", function (e) {
        cx = tx = e.clientX; cy = ty = e.clientY;
        cursor.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
        cursor.classList.add("is-on");
      });
      tile.addEventListener("pointermove", function (e) {
        tx = e.clientX; ty = e.clientY;
        if (!raf) raf = requestAnimationFrame(follow);
      });
      tile.addEventListener("pointerleave", function () { cursor.classList.remove("is-on"); });
      tile.addEventListener("click", function () { cursor.classList.remove("is-on"); });
    });
  }

  /* ---------- En-tête : s'efface en descendant, revient en remontant ---------- */

  var header = document.querySelector(".site-header");
  if (header) {
    var lastY = window.scrollY;
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      if (Math.abs(y - lastY) < 6) return;
      root.classList.toggle("header-hidden", y > lastY && y > 120);
      lastY = y;
    }, { passive: true });
  }

  /* ---------- Apparition douce des tuiles au défilement ---------- */

  var reveal = document.querySelectorAll(".tile, .game, .player");
  if (reveal.length && "IntersectionObserver" in window) {
    root.classList.add("js-reveal");
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); ro.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    reveal.forEach(function (el) { ro.observe(el); });
  }

  /* ---------- Lecteur audio ---------- */

  var player = document.querySelector(".player");
  if (player) {
    var audio = player.querySelector("audio");
    var buttons = Array.prototype.slice.call(player.querySelectorAll(".tracks button"));
    var titleEl = player.querySelector(".now-title");
    var artistEl = player.querySelector(".now-artist");
    var timeEl = player.querySelector(".player-time");
    var fill = player.querySelector(".rail-fill");
    var rail = player.querySelector(".rail");
    var pp = player.querySelector(".pp");
    var current = 0;

    var fmt = function (s) {
      if (!isFinite(s)) return "0:00";
      s = Math.floor(s);
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    };
    var setPlaying = function (on) {
      pp.setAttribute("aria-label", on ? "Pause" : "Lecture");
      pp.querySelector(".i-play").style.display = on ? "none" : "";
      pp.querySelector(".i-pause").style.display = on ? "" : "none";
    };
    var load = function (i, autoplay) {
      current = (i + buttons.length) % buttons.length;
      var b = buttons[current];
      buttons.forEach(function (x) { x.setAttribute("aria-current", x === b ? "true" : "false"); });
      titleEl.textContent = b.querySelector(".t").textContent;
      artistEl.textContent = b.querySelector(".a").textContent;
      audio.src = b.dataset.src;
      fill.style.width = "0";
      timeEl.textContent = "0:00";
      if (autoplay) audio.play();
    };

    buttons.forEach(function (b, i) {
      b.addEventListener("click", function () {
        if (i === current && audio.src) { audio.paused ? audio.play() : audio.pause(); }
        else load(i, true);
      });
    });
    pp.addEventListener("click", function () {
      if (!audio.src) load(current, true);
      else if (audio.paused) audio.play();
      else audio.pause();
    });
    player.querySelector(".prev").addEventListener("click", function () { load(current - 1, true); });
    player.querySelector(".next").addEventListener("click", function () { load(current + 1, true); });

    audio.addEventListener("play", function () { setPlaying(true); });
    audio.addEventListener("pause", function () { setPlaying(false); });
    audio.addEventListener("ended", function () { load(current + 1, true); });
    audio.addEventListener("timeupdate", function () {
      var d = audio.duration;
      fill.style.width = d ? (audio.currentTime / d) * 100 + "%" : "0";
      timeEl.textContent = fmt(audio.currentTime) + " / " + fmt(d);
    });

    var seek = function (e) {
      if (!audio.duration) return;
      var r = rail.getBoundingClientRect();
      audio.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * audio.duration;
    };
    rail.addEventListener("pointerdown", function (e) {
      seek(e);
      rail.setPointerCapture(e.pointerId);
      rail.addEventListener("pointermove", seek);
    });
    rail.addEventListener("pointerup", function () { rail.removeEventListener("pointermove", seek); });
    rail.addEventListener("keydown", function (e) {
      if (!audio.duration) return;
      if (e.key === "ArrowRight") audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
      if (e.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
    });

    load(0, false);
  }
})();
