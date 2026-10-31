// Rubik and Mali from the app's own files (no request to Google Fonts, DESIGN.md section 3).
import "@fontsource-variable/rubik/wght.css";
import "@fontsource/mali/700.css";
import "./ui/tokens.css";
import "./ui/app.css";
import { render } from "preact";
import { App } from "./ui/App";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Element #app fehlt in index.html");
}
render(<App />, root);
