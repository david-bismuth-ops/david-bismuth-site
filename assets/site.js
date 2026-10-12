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
  if (lb) {
    var frame = lb.querySelector(".lb-frame");
    var caption = lb.querySelector(".lb-caption");
    var lastTile = null;

    var open = function (tile) {
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
      caption.textContent = tile.dataset.credit || "";
      lb.showModal();
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
    // Un clic hors du film ferme la lecture
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });

    document.querySelectorAll(".tile[data-film]").forEach(function (tile) {
      tile.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return; // ouvrir dans un onglet reste possible
        e.preventDefault();
        open(tile);
      });
    });
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
