/**
 * UniSi embeddable signing form.
 *
 * Usage:
 *   <unisi-form slug="abc123"></unisi-form>
 *   <script src="https://your-unisi.example.com/embed.js" defer></script>
 *
 * Loads the /embed/<slug> page in an iframe sized to the parent. Posts
 * height updates from the inner page so the iframe can grow with content.
 */
(function () {
  if (window.customElements && customElements.get("unisi-form")) return;

  class UniSiForm extends HTMLElement {
    connectedCallback() {
      const slug = this.getAttribute("slug");
      if (!slug) {
        this.innerHTML = "<p style='color:red'>unisi-form: missing slug attribute</p>";
        return;
      }
      const origin = this.getAttribute("origin") || new URL(document.currentScript ? document.currentScript.src : window.location.href).origin;
      const iframe = document.createElement("iframe");
      iframe.src = `${origin}/embed/${encodeURIComponent(slug)}`;
      iframe.style.width = "100%";
      iframe.style.minHeight = "600px";
      iframe.style.border = "0";
      iframe.allow = "clipboard-write";
      this.appendChild(iframe);

      window.addEventListener("message", (e) => {
        if (e.origin !== origin) return;
        if (e.data && e.data.type === "unisi:resize" && typeof e.data.height === "number") {
          iframe.style.height = `${e.data.height}px`;
        }
      });
    }
  }

  if (window.customElements) customElements.define("unisi-form", UniSiForm);
})();
