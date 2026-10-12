/* David Bismuth — comportements du site (aucune dépendance). */
(function () {
  "use strict";

  /* ---------- Échelle 1920 calculée sans la barre de défilement (comme Readymag) ---------- */

  var root = document.documentElement;
  var setScale = function () {
    if (root.clientWidth >= 768) root.style.setProperty("--u", root.clientWidth / 1920 + "px");
    else root.style.removeProperty("--u");
  };
  setScale();
  window.addEventListener("resize", setScale);

  /* ---------- Aperçus vidéo : lecture seulement quand ils sont à l'écran ----------
     Ils jouent même avec « Réduire les animations » : ce sont des films muets, le contenu du site. */

  var previews = document.querySelectorAll("video[data-preview]");
  if (previews.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.preload !== "auto") v.preload = "auto";
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
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

  /* ---------- Lecture plein écran des films (media/*-full.mp4) ---------- */

  var lb = document.querySelector(".lightbox");
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".tile[data-film]"));
  if (lb) {
    var frame = lb.querySelector(".lb-frame");
    var caption = lb.querySelector(".lb-caption");
    var titleBox = lb.querySelector(".lb-title");
    var roleBox = lb.querySelector(".lb-role");
    var countBox = lb.querySelector(".lb-count");
    var lastTile = null;
    var index = 0;
    var pad = function (n) { return String(n).padStart(2, "0"); };

    var show = function (i) {
      index = (i + tiles.length) % tiles.length;
      var tile = tiles[index];
      lastTile = tile;
      frame.textContent = "";
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
    };

    var open = function (tile) {
      show(tiles.indexOf(tile));
      if (!lb.open) lb.showModal();
      document.documentElement.style.overflow = "hidden";
      // Un seul son à la fois : aperçus et lecteur audio se mettent en pause
      previews.forEach(function (v) { v.pause(); });
      document.querySelectorAll("audio").forEach(function (a) { a.pause(); });
    };

    var close = function () { if (lb.open) lb.close(); };

    lb.addEventListener("close", function () {
      frame.textContent = ""; // coupe le son immédiatement
      document.documentElement.style.overflow = "";
      if (lastTile) lastTile.focus({ preventScroll: true });
      previews.forEach(function (v) {
        var r = v.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) {
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        }
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
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });

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
    });
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

  /* ---------- En-tête : se masque en descendant, revient en remontant ---------- */

  var header = document.querySelector(".site-header");
  if (header) {
    var lastY = window.scrollY;
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      root.classList.toggle("is-scrolled", y > 40);
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
