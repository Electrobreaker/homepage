const emailChip = document.querySelector(".email-copy-chip");

if (emailChip) {
  const status = emailChip.querySelector(".email-copy-chip__status");
  const email = emailChip.dataset.email;

  const setState = (state, text) => {
    emailChip.classList.remove("is-copied", "is-error");

    if (state) {
      emailChip.classList.add(state);
    }

    status.textContent = text;
  };

  const fallbackCopy = (text) => {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";

    document.body.appendChild(textarea);
    textarea.select();

    const successful = document.execCommand("copy");

    document.body.removeChild(textarea);

    return successful;
  };

  emailChip.addEventListener("click", async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(email);
      } else {
        const copied = fallbackCopy(email);

        if (!copied) {
          throw new Error("Copy failed");
        }
      }

      setState("is-copied", "Copied");
      emailChip.setAttribute("aria-label", "Email copied");

      setTimeout(() => {
        setState(null, "Copy");
        emailChip.setAttribute("aria-label", "Copy email address");
      }, 1800);
    } catch (error) {
      setState("is-error", "Error");
      emailChip.setAttribute("aria-label", "Could not copy email");

      setTimeout(() => {
        setState(null, "Copy");
        emailChip.setAttribute("aria-label", "Copy email address");
      }, 1800);
    }
  });
}