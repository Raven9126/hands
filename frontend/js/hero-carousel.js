/**
 * Hero carousel — swipe/hover controls and broom hover effect on the visual.
 */
(function () {
  var root = document.querySelector("[data-hero-carousel]");
  if (!root) return;

  var track = root.querySelector(".hero-carousel-track");
  var slides = Array.prototype.slice.call(root.querySelectorAll(".hero-slide"));
  var dots = Array.prototype.slice.call(root.querySelectorAll("[data-hero-dot]"));
  var prevBtn = root.querySelector("[data-hero-prev]");
  var nextBtn = root.querySelector("[data-hero-next]");
  var stage = root.querySelector(".hero-carousel");
  var broom = root.querySelector(".hero-broom");
  var wipe = root.querySelector(".hero-wipe");
  if (!track || !slides.length || !stage) return;

  var index = 0;
  var startX = 0;
  var deltaX = 0;
  var dragging = false;
  var sweepTimer = null;
  var broomMode = (broom && broom.getAttribute("data-broom")) || "sweep";

  function goTo(next) {
    var total = slides.length;
    index = ((next % total) + total) % total;
    track.style.transform = "translateX(" + -index * 100 + "%)";
    slides.forEach(function (slide, i) {
      slide.classList.toggle("is-active", i === index);
    });
    dots.forEach(function (dot, i) {
      var on = i === index;
      dot.classList.toggle("is-active", on);
      dot.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function next() {
    goTo(index + 1);
  }

  function prev() {
    goTo(index - 1);
  }

  if (prevBtn) prevBtn.addEventListener("click", prev);
  if (nextBtn) nextBtn.addEventListener("click", next);

  dots.forEach(function (dot) {
    dot.addEventListener("click", function () {
      goTo(Number(dot.getAttribute("data-hero-dot")) || 0);
    });
  });

  stage.addEventListener("mousemove", function (ev) {
    var rect = stage.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width;
    stage.classList.toggle("is-hover-left", x < 0.28);
    stage.classList.toggle("is-hover-right", x > 0.72);

    if (broomMode === "sweep" && broom && stage.classList.contains("is-broom-active")) {
      var px = ev.clientX - rect.left;
      var py = ev.clientY - rect.top;
      broom.style.left = px - 52 + "px";
      broom.style.top = py - 52 + "px";
    }
  });

  stage.addEventListener("mouseleave", function () {
    stage.classList.remove("is-hover-left", "is-hover-right", "is-broom-active", "is-sweeping");
    if (broom) {
      broom.style.left = "";
      broom.style.top = "";
    }
    if (sweepTimer) {
      window.clearTimeout(sweepTimer);
      sweepTimer = null;
    }
  });

  function playSweep() {
    if (broomMode !== "sweep") return;
    stage.classList.remove("is-sweeping");
    // Force reflow so the animation can restart on every enter.
    void stage.offsetWidth;
    stage.classList.add("is-broom-active", "is-sweeping");
    if (sweepTimer) window.clearTimeout(sweepTimer);
    sweepTimer = window.setTimeout(function () {
      stage.classList.remove("is-sweeping");
    }, 1400);
  }

  stage.addEventListener("mouseenter", playSweep);

  stage.addEventListener("click", function (ev) {
    if (ev.target.closest("button")) return;
    var rect = stage.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width;
    if (x < 0.28) prev();
    else if (x > 0.72) next();
  });

  function onPointerDown(clientX) {
    dragging = true;
    startX = clientX;
    deltaX = 0;
    stage.classList.add("is-dragging");
  }

  function onPointerMove(clientX) {
    if (!dragging) return;
    deltaX = clientX - startX;
    track.style.transform = "translateX(calc(" + -index * 100 + "% + " + deltaX + "px))";
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove("is-dragging");
    track.style.transform = "";
    if (Math.abs(deltaX) > 48) {
      if (deltaX < 0) next();
      else prev();
    } else {
      goTo(index);
    }
    deltaX = 0;
  }

  stage.addEventListener(
    "touchstart",
    function (ev) {
      if (!ev.touches || !ev.touches[0]) return;
      onPointerDown(ev.touches[0].clientX);
    },
    { passive: true }
  );
  stage.addEventListener(
    "touchmove",
    function (ev) {
      if (!ev.touches || !ev.touches[0]) return;
      onPointerMove(ev.touches[0].clientX);
    },
    { passive: true }
  );
  stage.addEventListener("touchend", onPointerUp);
  stage.addEventListener("touchcancel", onPointerUp);

  stage.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      prev();
    } else if (ev.key === "ArrowRight") {
      ev.preventDefault();
      next();
    }
  });

  goTo(0);
})();
