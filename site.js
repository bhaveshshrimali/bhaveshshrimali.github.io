(() => {
  "use strict";

  document.documentElement.classList.add("js");

  const setupPublicationFilters = () => {
    const buttons = Array.from(document.querySelectorAll("[data-filter]"));
    const cards = Array.from(document.querySelectorAll(".publication-card[data-topic]"));

    if (!buttons.length || !cards.length) {
      return;
    }

    const applyFilter = (filter) => {
      cards.forEach((card) => {
        const matches = filter === "all" || card.dataset.topic === filter;
        card.hidden = !matches;
      });

      buttons.forEach((button) => {
        const active = button.dataset.filter === filter;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => applyFilter(button.dataset.filter || "all"));
    });
  };

  const setupSectionNavigation = () => {
    const links = Array.from(document.querySelectorAll(".nav-links a[href^='#']"));
    const sections = links
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter((section) => section instanceof HTMLElement);

    if (!("IntersectionObserver" in window) || !sections.length) {
      return;
    }

    const linkById = new Map(links.map((link) => [link.hash.slice(1), link]));
    const visibleSections = new Map();

    const updateCurrentLink = () => {
      const candidates = Array.from(visibleSections.entries())
        .filter((entry) => entry[1].isIntersecting)
        .sort((a, b) => b[1].intersectionRatio - a[1].intersectionRatio);
      const currentId = candidates.length ? candidates[0][0] : "";

      links.forEach((link) => link.removeAttribute("aria-current"));
      if (currentId && linkById.has(currentId)) {
        linkById.get(currentId).setAttribute("aria-current", "location");
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => visibleSections.set(entry.target.id, entry));
        updateCurrentLink();
      },
      { rootMargin: "-28% 0px -60% 0px", threshold: [0, 0.1, 0.35, 0.7] }
    );

    sections.forEach((section) => observer.observe(section));
  };

  const setupAnalytics = () => {
    const tokenMeta = document.querySelector('meta[name="cf-web-analytics-token"]');
    const token = tokenMeta ? tokenMeta.content.trim() : "";
    const localHosts = new Set(["", "localhost", "127.0.0.1", "::1"]);

    if (!token || localHosts.has(window.location.hostname)) {
      return;
    }

    const beacon = document.createElement("script");
    beacon.defer = true;
    beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
    beacon.dataset.cfBeacon = JSON.stringify({ token });
    document.head.append(beacon);
  };

  const stabilizeDeepLink = () => {
    if (!window.location.hash) {
      return;
    }

    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (!target) {
      return;
    }

    window.addEventListener("load", () => {
      window.requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    }, { once: true });
  };

  const setupVisitorDashboard = () => {
    const dashboard = document.querySelector(".visitor-dashboard");
    const canvas = document.getElementById("country-chart");
    const context = canvas instanceof HTMLCanvasElement ? canvas.getContext("2d") : null;
    const total = document.getElementById("visitor-total");
    const period = document.getElementById("visitor-period");
    const legend = document.getElementById("country-legend");

    if (!(dashboard instanceof HTMLElement) || !context || !total || !period || !legend) {
      return;
    }

    const refreshInterval = 60_000;
    const palette = ["#1f5b93", "#b76d1f", "#4f8070", "#795a93", "#ba5266", "#478598", "#8b7542", "#64717d"];
    const numberFormatter = new Intl.NumberFormat("en-US");
    const regionNames = typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames(["en"], { type: "region" })
      : null;
    let latestCountries = [];
    let refreshTimer = 0;

    const countryLabel = (code) => {
      if (code === "OTHER") return "Other";
      if (!code || code === "XX") return "Unknown";
      try {
        return regionNames ? regionNames.of(code) || code : code;
      } catch {
        return code;
      }
    };

    const clearLegend = () => {
      while (legend.firstChild) {
        legend.removeChild(legend.firstChild);
      }
    };

    const drawChart = () => {
      const bounds = canvas.getBoundingClientRect();
      const cssWidth = Math.max(280, Math.round(bounds.width || 640));
      const cssHeight = Math.round(cssWidth * 0.625);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);

      const chartTotal = latestCountries.reduce((sum, country) => sum + country.visitors, 0);
      const centerX = cssWidth * 0.5;
      const centerY = cssHeight * 0.48;
      const radius = Math.min(cssWidth, cssHeight) * 0.36;

      if (!chartTotal) {
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.strokeStyle = "rgba(237, 241, 230, 0.15)";
        context.lineWidth = Math.max(12, radius * 0.14);
        context.stroke();
        canvas.setAttribute("aria-label", "No country visitor data is available yet");
        return;
      }

      let startAngle = -Math.PI * 0.5;
      latestCountries.forEach((country, index) => {
        const angle = (country.visitors / chartTotal) * Math.PI * 2;
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.arc(centerX, centerY, radius, startAngle, startAngle + angle);
        context.closePath();
        context.fillStyle = palette[index % palette.length];
        context.fill();
        context.strokeStyle = "#081812";
        context.lineWidth = 2;
        context.stroke();

        if (country.visitors / chartTotal >= 0.08) {
          const labelAngle = startAngle + angle * 0.5;
          const labelRadius = radius * 0.68;
          const labelX = centerX + Math.cos(labelAngle) * labelRadius;
          const labelY = centerY + Math.sin(labelAngle) * labelRadius;
          const percentage = Math.round((country.visitors / chartTotal) * 100);
          context.fillStyle = "white";
          context.font = "750 12px Avenir Next, Segoe UI, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(`${percentage}%`, labelX, labelY);
        }

        startAngle += angle;
      });

      const accessibleSummary = latestCountries
        .map((country) => `${countryLabel(country.code)}: ${numberFormatter.format(country.visitors)}`)
        .join(", ");
      canvas.setAttribute("aria-label", `Visitor distribution by country. ${accessibleSummary}`);
    };

    const renderLegend = () => {
      clearLegend();
      latestCountries.forEach((country, index) => {
        const item = document.createElement("li");
        const swatch = document.createElement("span");
        const name = document.createElement("span");
        const value = document.createElement("span");

        swatch.className = `country-swatch country-swatch-${index % palette.length}`;
        swatch.setAttribute("aria-hidden", "true");
        name.className = "country-name";
        name.textContent = countryLabel(country.code);
        value.className = "country-value";
        value.textContent = numberFormatter.format(country.visitors);
        item.append(swatch, name, value);
        legend.append(item);
      });
    };

    const normalizeSnapshot = (snapshot) => {
      if (!snapshot || typeof snapshot !== "object") {
        throw new TypeError("Invalid visitor snapshot");
      }

      const countries = Array.isArray(snapshot.countries)
        ? snapshot.countries
          .filter((country) => country && typeof country.code === "string" && Number.isFinite(Number(country.visitors)))
          .map((country) => ({
            code: country.code.toUpperCase().slice(0, 5),
            visitors: Math.max(0, Math.round(Number(country.visitors)))
          }))
          .filter((country) => country.visitors > 0)
          .slice(0, 8)
        : [];

      return {
        configured: snapshot.configured === true,
        periodDays: Math.max(1, Math.min(180, Math.round(Number(snapshot.periodDays) || 30))),
        totalVisitors: Math.max(0, Math.round(Number(snapshot.totalVisitors) || 0)),
        countries
      };
    };

    const renderSnapshot = (snapshot) => {
      period.textContent = `Last ${snapshot.periodDays} days`;
      latestCountries = snapshot.countries;

      if (!snapshot.configured) {
        dashboard.dataset.dashboardState = "unconfigured";
        total.textContent = "—";
      } else {
        dashboard.dataset.dashboardState = "ready";
        total.textContent = numberFormatter.format(snapshot.totalVisitors);
      }

      renderLegend();
      drawChart();
    };

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refreshSnapshot, refreshInterval);
    };

    const refreshSnapshot = async () => {
      if (document.hidden) {
        scheduleRefresh();
        return;
      }

      try {
        const response = await fetch(`data/visitor-stats.json?t=${Date.now()}`, {
          cache: "no-store",
          credentials: "omit"
        });
        if (!response.ok) {
          throw new Error(`Visitor snapshot request failed with ${response.status}`);
        }
        renderSnapshot(normalizeSnapshot(await response.json()));
      } catch {
        dashboard.dataset.dashboardState = "error";
        latestCountries = [];
        clearLegend();
        drawChart();
      } finally {
        scheduleRefresh();
      }
    };

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(drawChart);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener("resize", drawChart, { passive: true });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.clearTimeout(refreshTimer);
      } else {
        refreshSnapshot();
      }
    });

    drawChart();
    refreshSnapshot();
  };

  const setupFemSimulationBackdrop = () => {
    const images = Array.from(
      document.querySelectorAll(".fem-simulation[data-motion-src][data-static-src]")
    ).filter((image) => image instanceof HTMLImageElement);

    if (!images.length) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    images.forEach((image) => {
      image.addEventListener("load", () => image.classList.add("is-ready"));
    });

    const syncSources = () => {
      const useStaticPoster = reducedMotion.matches || document.hidden;

      images.forEach((image) => {
        const source = useStaticPoster ? image.dataset.staticSrc : image.dataset.motionSrc;
        if (!source || image.getAttribute("src") === source) {
          return;
        }

        image.classList.remove("is-ready");
        image.src = source;
      });
    };

    document.addEventListener("visibilitychange", syncSources);

    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", syncSources);
    } else {
      reducedMotion.addListener(syncSources);
    }

    syncSources();
  };

  const setupResearchCanvas = () => {
    const canvas = document.getElementById("research-canvas");
    const context = canvas instanceof HTMLCanvasElement ? canvas.getContext("2d") : null;

    if (!context) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const equations = [
      { src: "images/equations/equation-01.png", x: 0.025, y: 0.13, speed: 0.018, compact: true },
      { src: "images/equations/equation-02.png", x: 0.34, y: 0.1, speed: 0.014 },
      { src: "images/equations/equation-03.png", x: 0.67, y: 0.14, speed: 0.022, compact: true },
      { src: "images/equations/equation-04.png", x: 0.035, y: 0.42, speed: 0.013, scale: 1.05 },
      { src: "images/equations/equation-05.png", x: 0.63, y: 0.43, speed: 0.025, compact: true, opacity: 0.24 },
      { src: "images/equations/equation-06.png", x: 0.055, y: 0.59, speed: 0.021, compact: true, opacity: 0.22 },
      { src: "images/equations/equation-07.png", x: 0.68, y: 0.6, speed: 0.016, opacity: 0.22 },
      { src: "images/equations/equation-08.png", x: 0.045, y: 0.83, speed: 0.019, scale: 1.05 },
      { src: "images/equations/equation-09.png", x: 0.39, y: 0.91, speed: 0.015, compact: true },
      { src: "images/equations/equation-10.png", x: 0.69, y: 0.9, speed: 0.024 },
      { src: "images/equations/equation-11.png", x: 0.31, y: 0.69, speed: 0.017, opacity: 0.22 },
      { src: "images/equations/equation-12.png", x: 0.72, y: 0.76, speed: 0.02, opacity: 0.24 }
    ];

    equations.forEach((equation) => {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => {
        if (reducedMotion.matches) {
          window.requestAnimationFrame(() => draw(performance.now()));
        }
      }, { once: true });
      image.src = equation.src;
      equation.image = image;
    });

    const loadMathAsset = (src) => {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => {
        if (reducedMotion.matches) {
          window.requestAnimationFrame(() => draw(performance.now()));
        }
      }, { once: true });
      image.src = src;
      return image;
    };

    const mathLabels = {
      mapping: loadMathAsset("images/equations/equation-13.png"),
      posterior: loadMathAsset("images/equations/equation-16.png"),
      loss: loadMathAsset("images/equations/equation-17.png")
    };

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let animationFrame = 0;
    let lastPaint = 0;
    let scrollPosition = window.scrollY;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw(performance.now());
    };

    const drawArrow = (fromX, fromY, toX, toY, color = "rgba(237, 241, 230, 0.18)") => {
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const head = Math.max(5, Math.min(width, height) * 0.008);

      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      context.lineTo(toX - Math.cos(angle - 0.55) * head, toY - Math.sin(angle - 0.55) * head);
      context.moveTo(toX, toY);
      context.lineTo(toX - Math.cos(angle + 0.55) * head, toY - Math.sin(angle + 0.55) * head);
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.stroke();
    };

    const drawMathAsset = (image, x, y, targetHeight, opacity = 0.2, align = "left") => {
      if (!image.complete || !image.naturalWidth) {
        return;
      }

      const targetWidth = targetHeight * (image.naturalWidth / image.naturalHeight);
      const drawX = align === "center" ? x - targetWidth * 0.5 : x;
      context.save();
      context.globalAlpha = opacity;
      context.drawImage(image, drawX, y - targetHeight * 0.5, targetWidth, targetHeight);
      context.restore();
    };

    const drawMappedBodies = () => {
      if (width < 760) {
        return;
      }

      const size = Math.min(width, height);
      const leftX = width * 0.39;
      const rightX = width * 0.56;
      const centerY = height * 0.24;
      const radius = size * 0.075;

      context.save();
      context.strokeStyle = "rgba(237, 241, 230, 0.14)";
      context.fillStyle = "rgba(237, 241, 230, 0.16)";
      context.lineWidth = 1;

      const body = (centerX, skew) => {
        context.beginPath();
        context.moveTo(centerX - radius, centerY + radius * 0.12);
        context.bezierCurveTo(centerX - radius * 0.72, centerY - radius, centerX + radius * 0.35, centerY - radius * (0.76 + skew), centerX + radius, centerY - radius * 0.05);
        context.bezierCurveTo(centerX + radius * 0.62, centerY + radius * (0.9 + skew), centerX - radius * 0.58, centerY + radius * 0.85, centerX - radius, centerY + radius * 0.12);
        context.stroke();

        for (let slice = -2; slice <= 2; slice += 1) {
          const x = centerX + slice * radius * 0.27;
          context.beginPath();
          context.moveTo(x - radius * 0.1, centerY - radius * 0.63);
          context.quadraticCurveTo(x + skew * radius, centerY, x + radius * 0.08, centerY + radius * 0.62);
          context.stroke();
        }
      };

      body(leftX, -0.08);
      body(rightX, 0.17);
      drawArrow(leftX + radius * 1.18, centerY, rightX - radius * 1.18, centerY, "rgba(157, 203, 209, 0.24)");
      drawMathAsset(mathLabels.mapping, (leftX + rightX) * 0.5, centerY - radius * 0.34, Math.max(15, size * 0.019), 0.22, "center");
      context.restore();
    };

    const drawGaussianProcess = () => {
      if (width < 720) {
        return;
      }

      const left = width * 0.69;
      const top = height * 0.67;
      const plotWidth = width * 0.25;
      const plotHeight = height * 0.17;
      const baseline = top + plotHeight * 0.52;

      context.save();
      context.strokeStyle = "rgba(237, 241, 230, 0.11)";
      context.fillStyle = "rgba(157, 203, 209, 0.15)";
      context.lineWidth = 0.8;
      context.strokeRect(left, top, plotWidth, plotHeight);

      const curve = (offset, color) => {
        context.beginPath();
        for (let step = 0; step <= 48; step += 1) {
          const t = step / 48;
          const uncertainty = 0.18 + Math.pow(t - 0.52, 2) * 1.1;
          const x = left + t * plotWidth;
          const mean = Math.sin(t * Math.PI * 2.15) * plotHeight * 0.2 + Math.cos(t * Math.PI * 4) * plotHeight * 0.045;
          const y = baseline - mean + offset * uncertainty * plotHeight;
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = color;
        context.stroke();
      };

      curve(-1, "rgba(157, 203, 209, 0.13)");
      curve(1, "rgba(157, 203, 209, 0.13)");
      curve(0, "rgba(226, 197, 139, 0.31)");

      [0.08, 0.24, 0.43, 0.62, 0.83].forEach((t, index) => {
        const x = left + t * plotWidth;
        const mean = Math.sin(t * Math.PI * 2.15) * plotHeight * 0.2 + Math.cos(t * Math.PI * 4) * plotHeight * 0.045;
        const y = baseline - mean + (index % 2 ? 1 : -1) * 2;
        context.beginPath();
        context.arc(x, y, 2, 0, Math.PI * 2);
        context.fill();
      });

      drawMathAsset(mathLabels.posterior, left, top - 13, 17, 0.21);
      context.restore();
    };

    const drawLossSurface = (time) => {
      if (width < 760) {
        return;
      }

      const centerX = width * 0.53;
      const centerY = height * 0.78;
      const surfaceWidth = width * 0.23;
      const surfaceHeight = height * 0.14;
      const drift = reducedMotion.matches ? 0 : Math.sin(time * 0.00022) * 0.08;
      const project = (u, v) => {
        const z = 0.42 * Math.sin((u + drift) * Math.PI * 2) * Math.cos(v * Math.PI * 1.7) + 0.17 * (u * u + v * v);
        return {
          x: centerX + (u - v) * surfaceWidth * 0.43,
          y: centerY + (u + v) * surfaceHeight * 0.18 - z * surfaceHeight * 0.78
        };
      };

      context.save();
      context.strokeStyle = "rgba(237, 241, 230, 0.105)";
      context.lineWidth = 0.7;

      for (let line = 0; line <= 12; line += 1) {
        const fixed = -1 + (line / 12) * 2;
        context.beginPath();
        for (let step = 0; step <= 24; step += 1) {
          const moving = -1 + (step / 24) * 2;
          const point = project(fixed, moving);
          if (step === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        }
        context.stroke();

        context.beginPath();
        for (let step = 0; step <= 24; step += 1) {
          const moving = -1 + (step / 24) * 2;
          const point = project(moving, fixed);
          if (step === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        }
        context.stroke();
      }

      drawMathAsset(mathLabels.loss, centerX, centerY - surfaceHeight * 0.9, 18, 0.19, "center");
      context.restore();
    };

    const drawAgentLoop = (time) => {
      if (width < 780) {
        return;
      }

      const centerX = width * 0.87;
      const centerY = height * 0.5;
      const radius = Math.min(width, height) * 0.105;
      const labels = ["OBSERVE", "PLAN", "TOOLS", "REFLECT"];
      const rotation = reducedMotion.matches ? -Math.PI / 2 : -Math.PI / 2 + Math.sin(time * 0.00018) * 0.035;

      context.save();
      context.strokeStyle = "rgba(157, 203, 209, 0.14)";
      context.fillStyle = "rgba(157, 203, 209, 0.19)";
      context.lineWidth = 0.9;
      context.beginPath();
      context.arc(centerX, centerY, radius * 0.66, 0, Math.PI * 2);
      context.stroke();

      const nodes = labels.map((label, index) => {
        const angle = rotation + index * Math.PI * 0.5;
        return {
          label,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        };
      });

      nodes.forEach((node, index) => {
        const next = nodes[(index + 1) % nodes.length];
        drawArrow(node.x, node.y, next.x, next.y, "rgba(157, 203, 209, 0.16)");
        context.beginPath();
        context.arc(node.x, node.y, 3, 0, Math.PI * 2);
        context.fill();
        context.font = "10px Avenir Next, sans-serif";
        context.textAlign = "center";
        context.fillText(node.label, node.x, node.y - 10);
      });

      context.font = "18px Georgia, serif";
      context.fillStyle = "rgba(226, 197, 139, 0.22)";
      context.fillText("Agent", centerX, centerY + 5);
      context.textAlign = "start";
      context.restore();
    };

    const drawMechanicsField = (time) => {
      const baseline = height * 0.76;
      const amplitude = Math.min(24, height * 0.03);
      const phase = reducedMotion.matches ? 0 : time * 0.00035;

      context.save();
      context.lineWidth = 0.85;

      for (let row = 0; row < 5; row += 1) {
        context.beginPath();
        for (let column = 0; column <= 32; column += 1) {
          const x = (column / 32) * width;
          const taper = Math.sin((column / 32) * Math.PI);
          const y = baseline + row * 22 + Math.sin(column * 0.42 + phase + row * 0.7) * amplitude * taper;
          if (column === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.strokeStyle = `rgba(237, 241, 230, ${0.045 + row * 0.009})`;
        context.stroke();
      }

      context.restore();
    };

    const drawEquations = () => {
      const compact = width < 640;
      const scrollShift = scrollPosition * 0.035;
      const renderScale = (compact ? 0.86 : 1.16) * (96 / 300);

      context.save();

      equations.forEach((equation) => {
        if (compact && !equation.compact) {
          return;
        }
        if (!equation.image.complete || !equation.image.naturalWidth) {
          return;
        }

        const wrap = height + 120;
        const y = ((equation.y * height - scrollShift * equation.speed * 12 + 60) % wrap + wrap) % wrap - 30;
        const x = compact ? Math.min(equation.x, 0.14) * width : equation.x * width;
        let drawWidth = equation.image.naturalWidth * renderScale * (equation.scale || 1);
        let drawHeight = equation.image.naturalHeight * renderScale * (equation.scale || 1);
        const maxWidth = compact ? width * 0.86 : width * 0.48;

        if (drawWidth > maxWidth) {
          const fit = maxWidth / drawWidth;
          drawWidth *= fit;
          drawHeight *= fit;
        }

        context.globalAlpha = equation.opacity || 0.18;
        context.drawImage(equation.image, x, y - drawHeight * 0.5, drawWidth, drawHeight);
      });

      context.restore();
    };

    const draw = (time) => {
      context.clearRect(0, 0, width, height);
      drawMechanicsField(time);
      drawMappedBodies();
      drawGaussianProcess();
      drawLossSurface(time);
      drawAgentLoop(time);
      drawEquations();
    };

    const animate = (time) => {
      animationFrame = 0;
      if (time - lastPaint >= 40) {
        draw(time);
        lastPaint = time;
      }
      if (!reducedMotion.matches && !document.hidden) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    };

    const start = () => {
      if (!animationFrame && !reducedMotion.matches && !document.hidden) {
        animationFrame = window.requestAnimationFrame(animate);
      } else if (reducedMotion.matches) {
        draw(performance.now());
      }
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", () => {
      scrollPosition = window.scrollY;
      if (reducedMotion.matches) {
        draw(performance.now());
      }
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else {
        start();
      }
    });

    const handleMotionPreference = () => {
      if (reducedMotion.matches && animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      start();
    };

    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", handleMotionPreference);
    } else {
      reducedMotion.addListener(handleMotionPreference);
    }

    resize();
    start();
  };

  setupPublicationFilters();
  setupSectionNavigation();
  setupAnalytics();
  stabilizeDeepLink();
  setupVisitorDashboard();
  setupFemSimulationBackdrop();
  setupResearchCanvas();
})();
