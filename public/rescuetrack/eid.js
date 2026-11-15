/**
 * RESCUETRACK – Lecteur carte eID belge
 * Utilise la Web Serial API (Chrome/Edge uniquement, HTTPS requis)
 *
 * Usage :
 *   import { readEidCard } from "./eid.js";
 *   const data = await readEidCard();
 *   // data = { lastName, firstName, birthDate, sex, nationalNumber, nationality, address }
 *
 * Note: Nécessite un driver de lecteur de carte qui expose les données
 * via port série ou via une application native de middleware.
 * Alternative: beid-middleware + bridge local WebSocket.
 */

export async function isEidSupported() {
  return "serial" in navigator;
}

/**
 * Lecture via Web Serial API.
 * Cette implémentation utilise le protocole BEID standard
 * en passant par le middleware eID belge qui expose un port COM virtuel.
 */
export async function readEidCard() {
  if (!("serial" in navigator)) {
    throw new Error("Web Serial API non supportée. Utilisez Chrome ou Edge.");
  }

  let port;
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
  } catch (err) {
    throw new Error("Impossible d'ouvrir le port série : " + err.message);
  }

  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();

  try {
    // Commande de lecture données identité eID (BEID protocol)
    const cmd = new Uint8Array([0x00, 0xA4, 0x04, 0x00, 0x0F,
      0xA0, 0x00, 0x00, 0x01, 0x77, 0x50, 0x4B, 0x43, 0x53, 0x2D, 0x31, 0x35]);
    await writer.write(cmd);

    let buffer = new Uint8Array(0);
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      const merged = new Uint8Array(buffer.length + value.length);
      merged.set(buffer);
      merged.set(value, buffer.length);
      buffer = merged;
      if (buffer.length >= 20) break;
    }

    return parseEidResponse(buffer);
  } finally {
    writer.releaseLock();
    reader.releaseLock();
    await port.close();
  }
}

/**
 * Alternative: lecture via middleware beid-bridge local (plus fiable)
 * Lance un serveur local sur port 13579 qui expose les données eID
 * https://github.com/e-Contract/eid-applet-service
 */
export async function readEidCardViaBridge() {
  try {
    const response = await fetch("http://localhost:13579/eid-data", {
      method: "GET",
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) throw new Error("Bridge non disponible");

    const data = await response.json();

    return {
      lastName: data.surname || data.lastName || "",
      firstName: data.givenName || data.firstName || "",
      birthDate: formatEidDate(data.dateOfBirth || ""),
      sex: mapEidSex(data.gender || data.sex || ""),
      nationalNumber: data.nationalNumber || data.rrn || "",
      nationality: data.nationality || "BE",
      address: {
        street: data.streetAndNumber || "",
        postalCode: data.zipCode || data.postalCode || "",
        locality: data.municipality || data.locality || ""
      }
    };
  } catch (err) {
    throw new Error("Le middleware eID n'est pas accessible : " + err.message);
  }
}

function formatEidDate(raw) {
  // eID format: DD.MM.YYYY ou YYYYMMDD
  if (!raw) return "";
  const clean = String(raw).replace(/\D/g, "");
  if (clean.length === 8) {
    // Check if DDMMYYYY
    const dd = clean.slice(0, 2);
    const mm = clean.slice(2, 4);
    const yyyy = clean.slice(4, 8);
    const month = parseInt(mm, 10);
    if (month >= 1 && month <= 12) {
      return `${yyyy}-${mm}-${dd}`;
    }
    // YYYYMMDD
    return `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`;
  }
  return "";
}

function mapEidSex(raw) {
  const s = String(raw || "").toUpperCase();
  if (s === "M" || s === "H" || s === "MALE" || s === "HOMME") return "Homme";
  if (s === "F" || s === "FEMALE" || s === "FEMME") return "Femme";
  return "Indéterminé / inconnu";
}

function parseEidResponse(buffer) {
  // Parsing simplifié TLV BEID
  // En production, utiliser une lib complète comme pkijs ou beid-sdk
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);

  return {
    lastName: extractTlvField(text, "surname") || "Inconnu",
    firstName: extractTlvField(text, "givenName") || "Inconnu",
    birthDate: "",
    sex: "Indéterminé / inconnu",
    nationalNumber: "",
    nationality: "BE",
    address: { street: "", postalCode: "", locality: "" }
  };
}

function extractTlvField(text, field) {
  const idx = text.indexOf(field);
  if (idx < 0) return "";
  return text.slice(idx + field.length, idx + field.length + 40).replace(/[^\x20-\x7E\xC0-\xFF]/g, "").trim();
}

/**
 * Interface UI intégrée – ajoute un bouton eID dans le formulaire patient
 */
export function injectEidButton(containerEl, onSuccess) {
  isEidSupported().then(supported => {
    if (!supported) return;

    const section = document.createElement("div");
    section.className = "eid-section";
    section.innerHTML = `
      <div class="eid-icon">🪪</div>
      <div class="eid-text">
        <strong>Lecture carte eID</strong>
        <span>Remplissage automatique via carte d'identité belge</span>
      </div>
      <button type="button" id="eidReadBtn" class="btn-secondary" style="min-width:130px">
        Lire la carte
      </button>
    `;
    containerEl.insertAdjacentElement("afterbegin", section);

    document.getElementById("eidReadBtn").addEventListener("click", async () => {
      const btn = document.getElementById("eidReadBtn");
      btn.disabled = true;
      btn.textContent = "Lecture…";
      try {
        // Essaie d'abord le bridge, puis Web Serial
        let data;
        try {
          data = await readEidCardViaBridge();
        } catch {
          data = await readEidCard();
        }
        onSuccess(data);
        btn.textContent = "✓ Lu";
        setTimeout(() => { btn.disabled = false; btn.textContent = "Lire la carte"; }, 3000);
      } catch (err) {
        alert("Erreur lecture eID : " + err.message);
        btn.disabled = false;
        btn.textContent = "Lire la carte";
      }
    });
  });
}
