const SUPABASE_URL = "https://rpcunbkstadgngqrjafp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO";
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const SUPABASE_AUTH_OPTIONS = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
};

async function getSupabaseClient() {
  if (window.HiddenRoomSupabase?.getClient) {
    return window.HiddenRoomSupabase.getClient();
  }

  if (window.__hiddenRoomSupabaseClient) {
    return window.__hiddenRoomSupabaseClient;
  }

  if (!window.__hiddenRoomSupabaseClientPromise) {
    window.__hiddenRoomSupabaseClientPromise = import(SUPABASE_CDN).then(({ createClient }) => {
      window.__hiddenRoomSupabaseClient = window.__hiddenRoomSupabaseClient
        || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_AUTH_OPTIONS);
      return window.__hiddenRoomSupabaseClient;
    });
  }

  return window.__hiddenRoomSupabaseClientPromise;
}

const supabase = await getSupabaseClient();

let registerMode = new URLSearchParams(window.location.search).get("mode") === "register";
let passwordResetCooldownUntil = 0;
let passwordResetCooldownTimer = null;
let passwordResetBusy = false;

const getSafeRedirect = () => {
  const fallback = "./dashboard.html";
  const returnTo = sessionStorage.getItem("hr_return_after_login");
  if (!returnTo) return fallback;

  sessionStorage.removeItem("hr_return_after_login");
  const allowedReturnPaths = ["../minijuegos/", "../kairen/", "../store/", "../media/"];
  return allowedReturnPaths.some((path) => returnTo.startsWith(path)) ? returnTo : fallback;
};

const { data: { user } } = await supabase.auth.getUser();
if (user) {
  window.location.href = getSafeRedirect();
}

const form = document.getElementById("login-form");
const submitButton = form.querySelector(".login-submit");
const registerLink = document.getElementById("js-register-link");
const passwordResetLink = document.getElementById("js-password-reset");

function ensureRegisterFields() {
  if (document.getElementById("js-register-fields")) return;

  const emailField = document.getElementById("usuario")?.closest(".login-field");
  const passwordField = document.getElementById("password")?.closest(".login-field");

  const registerWrap = document.createElement("div");
  registerWrap.id = "js-register-fields";
  registerWrap.innerHTML = `
    <div class="login-field">
      <label class="login-label" for="display_name">Nombre</label>
      <input class="login-input" id="display_name" type="text" name="display_name" placeholder="Nombre" autocomplete="name" required>
    </div>
    <div class="login-field">
      <label class="login-label" for="whatsapp">WhatsApp</label>
      <input class="login-input" id="whatsapp" type="tel" name="whatsapp" placeholder="WhatsApp" inputmode="numeric" pattern="[0-9]*" autocomplete="tel" required>
    </div>
  `;

  if (emailField) {
    form.insertBefore(registerWrap.children[0], emailField);
  }
  if (passwordField) {
    form.insertBefore(registerWrap.children[0], passwordField);
  }
}

function removeRegisterFields() {
  document.getElementById("display_name")?.closest(".login-field")?.remove();
  document.getElementById("whatsapp")?.closest(".login-field")?.remove();
}

function enhancePasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]:not([data-password-toggle-ready]), input[type="text"][data-password-visible="true"]:not([data-password-toggle-ready])').forEach((input) => {
    input.dataset.passwordToggleReady = "true";
    const wrapper = document.createElement("div");
    wrapper.className = "password-field";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-toggle";
    button.dataset.action = "toggle-password";
    button.setAttribute("aria-label", "Ver contraseña");
    button.innerHTML = '<span class="password-eye" aria-hidden="true"></span>';
    wrapper.appendChild(button);
  });
}

function syncRegisterMode() {
  if (registerMode) ensureRegisterFields();
  else removeRegisterFields();

  const emailLabel = document.querySelector('label[for="usuario"]');
  const emailInput = document.getElementById("usuario");
  const title = document.querySelector(".login-title");
  if (emailLabel) emailLabel.textContent = registerMode ? "Email" : "Correo";
  if (emailInput) emailInput.placeholder = "Correo";
  if (title) title.innerHTML = registerMode ? "Registrarse" : "Inicia<br>Sesion";

  submitButton.textContent = registerMode ? "Registrarse" : "Entrar";
  registerLink.textContent = registerMode ? "Iniciar sesion" : "Registrarse";
  enhancePasswordToggles();
}

document.addEventListener("input", (event) => {
  if (event.target?.id === "whatsapp") {
    event.target.value = event.target.value.replace(/\D/g, "");
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="toggle-password"]');
  if (!button) return;

  const input = button.closest(".password-field")?.querySelector("input");
  if (!input) return;

  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  input.dataset.passwordVisible = visible ? "false" : "true";
  button.innerHTML = '<span class="password-eye" aria-hidden="true"></span>';
  button.setAttribute("aria-label", visible ? "Ver contraseña" : "Ocultar contraseña");
});

function setPasswordResetCooldown(seconds = 60) {
  if (!passwordResetLink) return;

  passwordResetCooldownUntil = Date.now() + seconds * 1000;
  passwordResetLink.setAttribute("aria-disabled", "true");
  passwordResetLink.dataset.cooldown = "true";

  const tick = () => {
    const remaining = Math.ceil((passwordResetCooldownUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      passwordResetLink.removeAttribute("aria-disabled");
      delete passwordResetLink.dataset.cooldown;
      passwordResetLink.textContent = "SOLICITA";
      clearInterval(passwordResetCooldownTimer);
      passwordResetCooldownTimer = null;
      return;
    }
    passwordResetLink.textContent = `ESPERA ${remaining}s`;
  };

  tick();
  clearInterval(passwordResetCooldownTimer);
  passwordResetCooldownTimer = setInterval(tick, 1000);
}

function setPasswordResetBusy(isBusy) {
  passwordResetBusy = isBusy;
  if (!passwordResetLink || Date.now() < passwordResetCooldownUntil) return;

  if (isBusy) {
    passwordResetLink.setAttribute("aria-disabled", "true");
    passwordResetLink.textContent = "ENVIANDO...";
  } else {
    passwordResetLink.removeAttribute("aria-disabled");
    passwordResetLink.textContent = "SOLICITA";
  }
}

passwordResetLink?.addEventListener("click", async (event) => {
  event.preventDefault();

  if (passwordResetBusy || Date.now() < passwordResetCooldownUntil) return;

  const email = document.getElementById("usuario").value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Usuario no registrado");
    return;
  }

  setPasswordResetBusy(true);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("./recovery.html", window.location.href).href,
    });

    if (error) console.info("[HR] recovery request completed with a generic response:", error.message);

    setPasswordResetCooldown(60);
    alert("Si el correo está asociado a una cuenta, recibirás instrucciones de recuperación.");
  } finally {
    setPasswordResetBusy(false);
  }
});

registerLink?.addEventListener("click", (event) => {
  event.preventDefault();
  registerMode = !registerMode;
  syncRegisterMode();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("usuario").value.trim();
  const password = document.getElementById("password").value;
  const displayName = document.getElementById("display_name")?.value.trim() ?? "";
  const whatsapp = document.getElementById("whatsapp")?.value.trim() ?? "";
  const cleanWhatsapp = whatsapp.replace(/\D/g, "");

  if (registerMode) {
    if (!displayName || !cleanWhatsapp) {
      alert("Ingresa nombre y WhatsApp para registrarte.");
      return;
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      phone: cleanWhatsapp,
      password,
      options: {
        emailRedirectTo: new URL("./dashboard.html", window.location.href).href,
        data: {
          display_name: displayName,
          email,
          whatsapp: cleanWhatsapp,
        },
      },
    });

    if (error) {
      alert("No se pudo completar el registro. Verifica los datos e intenta nuevamente.");
      return;
    }

    if (signUpData?.session) {
      window.location.href = getSafeRedirect();
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      alert("Registro creado, pero no se pudo iniciar sesion automaticamente.");
      return;
    }

    window.location.href = getSafeRedirect();
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert("Login incorrecto");
    return;
  }

  window.location.href = getSafeRedirect();
});

syncRegisterMode();
