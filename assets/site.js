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
  var soundOn = false;
  var fades = new WeakMap();
  var fadeTo = function (v, target, ms) {
    clearInterval(fades.get(v));
    if (target > 0) {
      if (v.muted) { v.volume = 0; v.muted = false; }
      if (v.paused) play(v);
    }
    var from = v.volume, t0 = performance.now();
    fades.set(v, setInterval(function () {
      var k = Math.min(1, (performance.now() - t0) / ms);
      v.volume = from + (target - from) * k;
      if (k === 1) {
        clearInterval(fades.get(v));
        if (target === 0) v.muted = true;
      }
    }, 16));
  };
  var setSound = function (on) {
    soundOn = on;
    if (!soundBtn) return;
    soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
    soundBtn.querySelector(".sound-state").textContent = on ? "sound on" : "sound off";
    if (!on) previews.forEach(function (v) { if (!v.muted) fadeTo(v, 0, 200); });
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
      setSound(!soundOn);
      store.set("db-sound", soundOn ? "1" : "0");
    });
    if (store.get("db-sound") === "1") setSound(true);
  }

  /* ---------- Lecture plein écran des films (media/*-full.mp4) ---------- */

  var lb = document.querySelector(".lightbox");
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".tile[data-film]"));
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
      // Un seul son à la fois : aperçus et lecteur audio se mettent en pause
      previews.forEach(function (v) { v.muted = true; v.pause(); });
      document.querySelectorAll("audio").forEach(function (a) { a.pause(); });
      if (floatVideo) { floatVideo.muted = true; floatVideo.pause(); }
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

  /* ---------- En-tête et contacts : s'effacent en descendant, reviennent en remontant ---------- */

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
