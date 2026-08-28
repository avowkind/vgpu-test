import { demos } from "./demos";
import "./index.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

app.innerHTML = `
  <main class="home">
    <header class="home-header">
      <p class="eyebrow">vgpu experiments</p>
      <h1>Demos</h1>
      <p class="lede">WebGPU sketches built with the vgpu library.</p>
    </header>
    <ul class="demo-list">
      ${demos
        .map(
          (demo) => `
        <li>
          <a href="${demo.href}">
            <span class="demo-title">${demo.title}</span>
            <span class="demo-desc">${demo.description}</span>
          </a>
        </li>
      `,
        )
        .join("")}
    </ul>
  </main>
`;
