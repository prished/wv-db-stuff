/* Water Vipers OC Timer — realtime sync
   ---------------------------------------------------------------
   Uses Firebase Realtime Database as the relay between phones.
   No Bluetooth is used anywhere — Bluetooth from a web app is not
   supported on iPhone (Safari never implemented Web Bluetooth), so
   phones join a session by typing a short shared code instead of
   pairing over Bluetooth. Everything travels over the phone's normal
   WiFi/cellular connection, the same one the rest of the app uses.

   Clock sync: Firebase's built-in ".info/serverTimeOffset" gives each
   phone its own offset to the server's clock automatically — no custom
   handshake is needed. Every timestamp this module writes is
   Date.now() + that offset, so all phones agree on the same clock
   without ever talking to each other directly.

   Offline behaviour: the Firebase SDK queues writes locally and sends
   them once the connection returns, and local UI updates happen
   immediately (before the write is even confirmed), so a start/finish
   tap never waits on the network. This module also exposes real
   online/offline state via ".info/connected" for the header indicator.
*/

const Sync = (() => {
  let app = null, db = null, ready = false;
  let sessionCode = null;
  let serverOffsetMs = 0;
  let connected = false;
  let refs = {};
  let listeners = { roster: null, event: null, presence: null, connection: null };

  function init() {
    if (ready) return true;
    if (typeof firebase === "undefined" || !window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) {
      console.warn("[sync] No Firebase config found — running in local-only mode.");
      return false;
    }
    try {
      app = firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.database();
      ready = true;

      firebase.database().ref(".info/serverTimeOffset").on("value", (snap) => {
        serverOffsetMs = snap.val() || 0;
      });

      firebase.database().ref(".info/connected").on("value", (snap) => {
        connected = snap.val() === true;
        if (listeners.connection) listeners.connection(connected);
      });

      return true;
    } catch (e) {
      console.error("[sync] Firebase init failed:", e);
      return false;
    }
  }

  function now() { return Date.now() + serverOffsetMs; }

  function genCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  /* ---------- coordinator: create & host a session ---------- */
  function createSession(sessionObj) {
    if (!init()) return Promise.resolve(null);
    const code = genCode();
    const ref = db.ref("sessions/" + code);
    return ref.set({
      meta: {
        name: sessionObj.name, distance: sessionObj.distance,
        date: sessionObj.date, createdAt: now()
      },
      roster: sessionObj.paddlers.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}),
      shifts: sessionObj.shifts || {}
    }).then(() => {
      sessionCode = code;
      refs.session = ref;
      db.ref("sessions/" + code + "/presence/coordinator").onDisconnect().remove();
      db.ref("sessions/" + code + "/presence/coordinator").set({ online: true, ts: now() });
      return code;
    }).catch((e) => { console.error("[sync] createSession failed:", e); return null; });
  }

  /* ---------- start/finish: join with the coordinator's code ---------- */
  function joinSession(code, role) {
    if (!init()) return Promise.resolve(false);
    const ref = db.ref("sessions/" + code);
    return ref.once("value").then((snap) => {
      if (!snap.exists()) return false;
      sessionCode = code;
      refs.session = ref;
      db.ref("sessions/" + code + "/presence/" + role).onDisconnect().remove();
      db.ref("sessions/" + code + "/presence/" + role).set({ online: true, ts: now() });
      return true;
    }).catch((e) => { console.error("[sync] joinSession failed:", e); return false; });
  }

  function watchPresence(cb) {
    if (!ready || !sessionCode) return;
    const ref = db.ref("sessions/" + sessionCode + "/presence");
    listeners.presence = ref.on("value", (snap) => cb(snap.val() || {}));
  }

  function pushRosterUpdate(paddler) {
    if (!ready || !sessionCode) return;
    db.ref(`sessions/${sessionCode}/roster/${paddler.id}`).set(paddler);
  }

  function watchRoster(cb) {
    if (!ready || !sessionCode) return;
    const ref = db.ref("sessions/" + sessionCode + "/roster");
    listeners.roster = ref.on("value", (snap) => cb(snap.val() || {}));
  }

  /* ---------- live timing events ---------- */
  function pushStart(paddlerId, byRole) {
    if (!ready || !sessionCode) return null;
    const ts = now();
    db.ref(`sessions/${sessionCode}/events/${paddlerId}_start`).set({ paddlerId, type: "start", ts, by: byRole });
    return ts;
  }
  function pushFinish(paddlerId, byRole) {
    if (!ready || !sessionCode) return null;
    const ts = now();
    db.ref(`sessions/${sessionCode}/events/${paddlerId}_finish`).set({ paddlerId, type: "finish", ts, by: byRole });
    return ts;
  }
  function pushCancelStart(paddlerId) {
    if (!ready || !sessionCode) return;
    db.ref(`sessions/${sessionCode}/events/${paddlerId}_start`).remove();
  }
  function pushCancelFinish(paddlerId) {
    if (!ready || !sessionCode) return;
    db.ref(`sessions/${sessionCode}/events/${paddlerId}_finish`).remove();
  }

  function watchEvents(cb) {
    if (!ready || !sessionCode) return;
    const ref = db.ref("sessions/" + sessionCode + "/events");
    listeners.event = ref.on("value", (snap) => cb(snap.val() || {}));
  }

  function leaveSession() {
    Object.entries(listeners).forEach(([k, off]) => {
      if (k === "connection" || !off) return;
      db && db.ref("sessions/" + sessionCode + "/" + k).off("value", off);
    });
    sessionCode = null;
    refs = {};
  }

  return {
    init, createSession, joinSession, watchPresence, watchRoster, pushRosterUpdate,
    pushStart, pushFinish, pushCancelStart, pushCancelFinish, watchEvents, leaveSession,
    get code() { return sessionCode; },
    get isConnected() { return connected; },
    get isReady() { return ready; },
    onConnectionChange(cb) { listeners.connection = cb; },
    now
  };
})();
