/* ==========================================================================
   Dump-N-Done — site behaviour
   1. Mobile navigation
   2. Current year in footer
   3. Estimate report generator
   4. Quote form: validation + fetch submission with no-JS fallback
   ========================================================================== */
(function () {
  "use strict";

  var FORM_ENDPOINT = "https://vision.leadrai.com/api/forms/c47223b829afd076973ba1f079fa9d3b";

  /* ----------------------------------------------------- 1. Mobile nav --- */
  var navToggle = document.getElementById("navToggle");
  var siteNav = document.getElementById("siteNav");

  function closeNav() {
    if (!siteNav || !navToggle) return;
    siteNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    siteNav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) closeNav();
    });
  }

  /* ---------------------------------------------------- 2. Footer year --- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* --------------------------------------- 3. Estimate report generator --- */
  var estimateForm = document.getElementById("estimateForm");
  var report = document.getElementById("report");
  var reportField = document.getElementById("estimate-report");

  // Price anchors per "truck unit" (1 unit ~= a pickup-bed load).
  var UNIT_LOW = 165;
  var UNIT_HIGH = 235;

  function formatMoney(n) {
    return "$" + Math.round(n / 5) * 5;
  }

  function spaceLabel(units) {
    if (units <= 0.45) return "Single item / minimum load";
    if (units <= 0.9) return "About a quarter truck";
    if (units <= 1.5) return "About a half truck";
    if (units <= 2.2) return "About a three-quarter truck";
    if (units <= 3.2) return "A full truck load";
    return "Two or more truck loads";
  }

  function crewLabel(units) {
    if (units <= 0.9) return "2 crew · 30–60 min";
    if (units <= 1.6) return "2 crew · 1–2 hours";
    if (units <= 2.6) return "2–3 crew · 2–3 hours";
    return "3 crew · half day";
  }

  function generateReport() {
    if (!estimateForm) return null;

    var checks = estimateForm.querySelectorAll('input[type="checkbox"]:checked');
    var items = [];
    var rawVolume = 0;

    Array.prototype.forEach.call(checks, function (c) {
      items.push(c.getAttribute("data-label") || c.parentNode.textContent.trim());
      rawVolume += parseFloat(c.getAttribute("data-vol")) || 0;
    });

    var sizeInput = estimateForm.querySelector('input[name="size"]:checked');
    var accessInput = estimateForm.querySelector('input[name="access"]:checked');

    var sizeMult = sizeInput ? parseFloat(sizeInput.value) : 1;
    var accessMult = accessInput ? parseFloat(accessInput.value) : 1;
    var sizeLabel = sizeInput ? sizeInput.getAttribute("data-label") : "Not specified";
    var accessLabel = accessInput ? accessInput.getAttribute("data-label") : "Not specified";
    var accessNote = accessInput ? accessInput.getAttribute("data-note") : null;

    // Category mix nudges volume, the size answer drives it.
    var categoryFactor = items.length ? 0.72 + Math.min(rawVolume, 18) / 26 : 0.72;
    var units = Math.max(0.35, sizeMult * categoryFactor);

    var low = Math.max(89, units * UNIT_LOW * accessMult);
    var high = Math.max(129, units * UNIT_HIGH * accessMult);

    // Diversion rate: metal/e-waste and yard debris divert better than mixed debris.
    var divert = 55;
    items.forEach(function (label) {
      if (/appliance|electronic/i.test(label)) divert += 8;
      if (/yard/i.test(label)) divert += 5;
      if (/construction/i.test(label)) divert -= 10;
    });
    divert = Math.max(35, Math.min(85, divert));

    var notes = [];
    if (!items.length) {
      notes.push("No categories selected yet — this range assumes a mixed household load.");
    }
    if (accessNote) {
      notes.push("Includes extra labor for " + accessNote + ".");
    }
    if (/Hot tub|demo/i.test(items.join(" "))) {
      notes.push("Hot tub and structure teardowns are quoted after a quick photo review — send a picture with your request and we'll confirm.");
    }
    if (units > 3.2) {
      notes.push("This likely needs more than one trip; we'll confirm scheduling when you send the report.");
    }
    notes.push("Labor, loading, sweep-up and disposal fees are already included.");

    return {
      items: items.length ? items : ["Mixed household junk"],
      space: spaceLabel(units),
      priceRange: formatMoney(low) + "–" + formatMoney(high),
      crew: crewLabel(units),
      divert: divert + "% recycled or donated",
      sizeLabel: sizeLabel,
      accessLabel: accessLabel,
      notes: notes.join(" ")
    };
  }

  function reportToText(r) {
    return [
      "DUMP-N-DONE ESTIMATE REPORT",
      "Items: " + r.items.join(", "),
      "Amount: " + r.sizeLabel,
      "Access: " + r.accessLabel,
      "Estimated truck space: " + r.space,
      "Estimated price range: " + r.priceRange,
      "Crew & time on site: " + r.crew,
      "Expected diversion: " + r.divert
    ].join("\n");
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  if (estimateForm && report) {
    estimateForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = generateReport();
      if (!r) return;

      setText("rSpace", r.space);
      setText("rPrice", r.priceRange);
      setText("rCrew", r.crew);
      setText("rDivert", r.divert);
      setText("rItems", r.items.join(", "));
      setText("rNotes", r.notes);

      report.hidden = false;
      if (reportField) reportField.value = reportToText(r);

      report.focus();
      report.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    var reportEdit = document.getElementById("reportEdit");
    if (reportEdit) {
      reportEdit.addEventListener("click", function () {
        report.hidden = true;
        estimateForm.scrollIntoView({ behavior: "smooth", block: "center" });
        var first = estimateForm.querySelector("input");
        if (first) first.focus();
      });
    }

    var reportSend = document.getElementById("reportSend");
    if (reportSend) {
      reportSend.addEventListener("click", function () {
        var nameField = document.getElementById("name");
        if (nameField) {
          window.setTimeout(function () { nameField.focus(); }, 450);
        }
      });
    }
  }

  /* ------------------------------------------------- 4. Quote form flow --- */
  var contactForm = document.getElementById("contactForm");
  var formSuccess = document.getElementById("formSuccess");
  var formError = document.getElementById("formError");
  var submitBtn = document.getElementById("submitBtn");
  var pageField = document.getElementById("pageField");

  // _page must carry the current URL so visitors return to the right page.
  if (pageField) pageField.value = window.location.href;

  function showSuccess(scroll) {
    if (!formSuccess) return;
    formSuccess.hidden = false;
    if (contactForm) contactForm.hidden = true;
    if (scroll) {
      formSuccess.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // Plain (no-JS style) submission returns with ?submitted=1
  try {
    if (new URLSearchParams(window.location.search).get("submitted") === "1") {
      showSuccess(true);
    }
  } catch (err) {
    if (window.location.search.indexOf("submitted=1") !== -1) showSuccess(true);
  }

  function clearFieldError(field) {
    field.removeAttribute("aria-invalid");
    var wrap = field.closest(".field");
    if (!wrap) return;
    var msg = wrap.querySelector(".field-error");
    if (msg) msg.parentNode.removeChild(msg);
  }

  function setFieldError(field, message) {
    field.setAttribute("aria-invalid", "true");
    var wrap = field.closest(".field");
    if (!wrap || wrap.querySelector(".field-error")) return;
    var msg = document.createElement("span");
    msg.className = "field-error";
    msg.textContent = message;
    wrap.appendChild(msg);
  }

  function validate(form) {
    var ok = true;
    var firstBad = null;
    var required = form.querySelectorAll("[required]");

    Array.prototype.forEach.call(required, function (field) {
      clearFieldError(field);
      var value = (field.value || "").trim();
      if (!value) {
        setFieldError(field, "This field is required.");
        ok = false;
        if (!firstBad) firstBad = field;
      } else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        setFieldError(field, "Please enter a valid email address.");
        ok = false;
        if (!firstBad) firstBad = field;
      }
    });

    if (firstBad) firstBad.focus();
    return ok;
  }

  if (contactForm) {
    contactForm.addEventListener("input", function (e) {
      if (e.target.hasAttribute("aria-invalid")) clearFieldError(e.target);
    });

    contactForm.addEventListener("submit", function (e) {
      if (!validate(contactForm)) {
        e.preventDefault();
        return;
      }

      // Progressive enhancement: submit via fetch to the same endpoint.
      // If fetch is unavailable, the browser performs the normal POST.
      if (!window.fetch) return;

      e.preventDefault();

      if (formError) formError.hidden = true;
      if (submitBtn) {
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.textContent = "Sending…";
      }

      if (pageField) pageField.value = window.location.href;

      var payload = {};
      var data = new FormData(contactForm);
      data.forEach(function (value, key) {
        payload[key] = value;
      });
      payload._page = window.location.href;

      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().catch(function () { return { ok: res.ok }; });
        })
        .then(function (json) {
          if (json && json.ok) {
            showSuccess(true);
          } else {
            throw new Error("Submission rejected");
          }
        })
        .catch(function () {
          if (submitBtn) {
            submitBtn.removeAttribute("aria-busy");
            submitBtn.textContent = "Send my quote request";
          }
          if (formError) {
            formError.textContent =
              "Sorry — something went wrong sending your request. Please try again, or email hello@dumpndone.com and we'll get right back to you.";
            formError.hidden = false;
          }
        });
    });
  }
})();
