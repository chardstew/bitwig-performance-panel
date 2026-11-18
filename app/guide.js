const dialog = document.querySelector("#gallery-dialog");
const image = document.querySelector("#gallery-image");
const caption = document.querySelector("#gallery-caption");

for (const trigger of document.querySelectorAll(".gallery-open")) {
  trigger.addEventListener("click", () => {
    image.src = trigger.dataset.image;
    image.alt = trigger.dataset.alt;
    caption.textContent = trigger.dataset.caption;
    dialog.classList.remove("zoomed");
    dialog.showModal();
  });
}

document.querySelector("#gallery-close").addEventListener("click", () => dialog.close());
document.querySelector("#gallery-zoom").addEventListener("click", () => dialog.classList.toggle("zoomed"));
dialog.addEventListener("pointerdown", (event) => {
  const bounds = dialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside || event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  dialog.classList.remove("zoomed");
  image.removeAttribute("src");
});
