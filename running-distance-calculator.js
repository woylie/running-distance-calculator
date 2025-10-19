class RunningDistanceCalculator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.storageKey =
      this.getAttribute("storage-key") || "runningDistanceHistory";
    this.segments = [{ duration: "", pace: "" }];
  }

  connectedCallback() {
    this.render();
    this.renderSegments();
    this.renderHistory();
  }

  parseTime(str) {
    if (!str) return 0;

    const parts = str.split(":").map(Number);

    if (parts.some(isNaN)) return NaN;

    if (parts.length === 3) {
      const [h, m, s] = parts;
      if (m > 59 || s > 59 || h < 0 || m < 0 || s < 0) return NaN;
      return h * 60 + m + s / 60;
    }

    if (parts.length === 2) {
      const [m, s] = parts;
      if (s > 59 || m < 0 || s < 0) return NaN;
      return m + s / 60;
    }

    if (parts.length === 1) {
      return parts[0];
    }

    return NaN;
  }

  distance(durationStr, paceStr) {
    const duration = this.parseTime(durationStr);
    const pace = this.parseTime(paceStr);

    if (isNaN(duration) || isNaN(pace) || duration === 0 || pace === 0) {
      return 0;
    }

    return (duration / pace).toFixed(2);
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --text-normal: #000000;
          --text-inverted: #FFFFFF;
          --text-button-secondary: var(--text-normal);
          --background-primary: #0071af;
          --background-secondary: #f6f6f6;
          --background-critical: #e0002b;
          --background-surface: #fff;
          --border-normal: #e2e2e2;
          
          --border: 1px solid var(--border-normal);
          --radius: 4px;
          
          display: block;
          max-width: 800px;
          margin: 1.5rem auto;
          padding: 1.5rem;
          border-radius: 8px;
          font-family: system-ui, sans-serif;
          background: var(--background-surface);
          color: var(--text-normal);
        }

        @media (prefers-color-scheme: dark) {
          :host {
            --text-normal: #fff;
            --text-inverted: #000;
            --text-button-secondary: var(--text-inverted);
            --background-primary: #b9e3ff;
            --background-secondary: #e2e2e2;
            --background-critical: #e0002b;
            --background-surface: #1d2027;
            --border-normal: #3d454b;

            color-scheme: dark;
          }
        }

        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

       
        th, td {
          border-right: var(--border);
          border-bottom: var(--border);
          padding: 0.5rem;
          text-align: left;
        }

        th {
          border-top: var(--border);
        }

        th:first-child {
          border-top-left-radius: var(--radius);
        }

        th:last-child {
          border-top-right-radius: var(--radius);
        }

        th:first-child, td:first-child {
          border-left: var(--border);
        }

        tbody tr:last-child td:last-child {
          border-bottom-right-radius: var(--radius);
        }
        
        tbody tr:last-child td:first-child {
          border-bottom-left-radius: var(--radius);
        }

        #calculator > * + *,
        table + button {
          margin-top: 1.5rem;
        }

        input {
          width: 90%;
          padding: 0.5rem;
          border: 1px solid var(--border-normal);
          border-radius: var(--radius);
          font-size: 1rem;
        }

        input.invalid {
          border-color: var(--background-critical);
        }
        
        button {
          padding: 0.5rem;
          cursor: pointer;
          border-radius: 4px;
          border: none;
          background-color: var(--background-secondary);
          color: var(--text-button-secondary);
        }

        #add-segment {
          background-color: var(--background-primary);
          color: var(--text-inverted);
        }
        
        #save-calc {
          background-color: var(--background-primary);
          color: var(--text-inverted);
        }
        
        .remove {
          background-color: var(--background-critical);
          color: white;
        }

        .delete-history, #delete-all-history {
          background-color: var(--background-critical);
          color:white;
          font-size:0.8rem; s
          padding: 0.2rem 0.4rem;
        }

        ul {
          list-style-type: none;
          margin-left: 0;
          padding: 0;
        }

        li + li {
          margin-top: 0.75rem;
        }

        button + button {
          margin-left: 0.5rem;
        }

        #total {
          font-weight: bold;
        }
      </style>
      
      <div id="calculator">
        <section aria-label="Run segments">
          <table class="segments-table">
            <thead>
              <tr>
                <th>Duration</th>
                <th>Pace</th>
                <th>Distance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="segments-body"></tbody>
          </table>
          <button id="add-segment">Add Segment</button>
        </section>

        <div id="total" aria-live="polite">Total Distance: 0 km</div>
        <button id="save-calc">Save Calculation</button>

        <section aria-labelledby="history-title">
          <h2 id="history-title">History</h2>
          <button id="delete-all-history">Delete All History</button>
          <ul id="history-list"></ul>
        </section>
      </div>
    `;

    this.shadowRoot.querySelector("#add-segment").onclick = () =>
      this.addSegment();
    this.shadowRoot.querySelector("#save-calc").onclick = () =>
      this.saveCalculation();
    this.shadowRoot.querySelector("#delete-all-history").onclick = () =>
      this.deleteAllHistory();
  }

  renderSegments() {
    const segmentsBody = this.shadowRoot.querySelector("#segments-body");
    segmentsBody.innerHTML = "";

    const srOnlyStyle = document.createElement("style");
    srOnlyStyle.textContent = `
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      border: 0;
    }
  `;
    this.shadowRoot.appendChild(srOnlyStyle);

    this.segments.forEach((segment, index) => {
      // duration

      const tr = document.createElement("tr");
      const tdDuration = document.createElement("td");
      const durationLabel = document.createElement("label");
      const durationInput = document.createElement("input");

      durationLabel.className = "sr-only";
      durationLabel.textContent = `Duration for segment ${index + 1}`;
      durationInput.type = "text";
      durationInput.placeholder = "hh:mm:ss or mm:ss";
      durationInput.value = segment.duration;
      durationInput.oninput = () => {
        segment.duration = durationInput.value;
        this.validateInput(durationInput);
        this.updateDistances();
      };
      tdDuration.appendChild(durationLabel);
      tdDuration.appendChild(durationInput);

      // pace

      const tdPace = document.createElement("td");
      const paceLabel = document.createElement("label");
      const paceInput = document.createElement("input");

      paceLabel.className = "sr-only";
      paceLabel.textContent = `Pace for segment ${index + 1}`;
      paceInput.type = "text";
      paceInput.placeholder = "mm:ss per km";
      paceInput.value = segment.pace;
      paceInput.oninput = () => {
        segment.pace = paceInput.value;
        this.validateInput(paceInput);
        this.updateDistances();
      };
      tdPace.appendChild(paceLabel);
      tdPace.appendChild(paceInput);

      // distance
      const tdDistance = document.createElement("td");
      tdDistance.textContent =
        this.distance(segment.duration, segment.pace) + " km";

      // action
      const tdAction = document.createElement("td");
      if (this.segments.length > 1) {
        const btn = document.createElement("button");
        btn.textContent = "Remove";
        btn.className = "remove";
        btn.onclick = () => {
          this.segments.splice(index, 1);
          this.renderSegments();
        };
        tdAction.appendChild(btn);
      }

      tr.append(tdDuration, tdPace, tdDistance, tdAction);
      segmentsBody.appendChild(tr);
    });

    this.updateDistances();
  }

  validateInput(inputEl) {
    const val = inputEl.value;
    const valid = !isNaN(this.parseTime(val));
    inputEl.classList.toggle("invalid", !valid);
  }

  updateDistances() {
    const segmentsBody = this.shadowRoot.querySelector("#segments-body");
    const trs = segmentsBody.querySelectorAll("tr");
    let total = 0;

    this.segments.forEach((segment, i) => {
      const d = this.distance(segment.duration, segment.pace);
      total += parseFloat(d);
      trs[i].querySelectorAll("td")[2].textContent = d + " km";
    });

    this.shadowRoot.querySelector("#total").textContent =
      "Total Distance: " + total.toFixed(2) + " km";
  }

  addSegment() {
    this.segments.push({ duration: "", pace: "" });
    this.renderSegments();
  }

  saveCalculation() {
    const entry = {
      timestamp: new Date().toISOString(),
      segments: this.segments.map((s) => ({ ...s })),
      totalDistance: this.segments
        .reduce(
          (sum, s) => sum + parseFloat(this.distance(s.duration, s.pace) || 0),
          0,
        )
        .toFixed(2),
    };

    const history = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
    history.unshift(entry);
    localStorage.setItem(this.storageKey, JSON.stringify(history));
    this.renderHistory();
  }

  renderHistory() {
    const historyList = this.shadowRoot.querySelector("#history-list");
    historyList.innerHTML = "";
    const history = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
    history.forEach((entry, index) => {
      const li = document.createElement("li");

      const btnLoad = document.createElement("button");
      btnLoad.textContent =
        new Date(entry.timestamp).toLocaleString() +
        " - " +
        entry.totalDistance +
        " km";
      btnLoad.onclick = () => {
        this.segments = entry.segments.map((s) => ({ ...s }));
        this.renderSegments();
      };
      li.appendChild(btnLoad);

      const btnDelete = document.createElement("button");
      btnDelete.textContent = "×";
      btnDelete.className = "delete-history";
      btnDelete.onclick = () => {
        history.splice(index, 1);
        localStorage.setItem(this.storageKey, JSON.stringify(history));
        this.renderHistory();
      };
      li.appendChild(btnDelete);

      historyList.appendChild(li);
    });
  }

  deleteAllHistory() {
    if (confirm("Delete all history?")) {
      localStorage.removeItem(this.storageKey);
      this.renderHistory();
    }
  }
}

customElements.define("running-distance-calculator", RunningDistanceCalculator);
