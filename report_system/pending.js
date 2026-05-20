// ============================================================
//  pending.js — Pending Approval Page
//  Checks account status live and redirects when approved
// ============================================================

import { initializeApp }        from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth,
         onAuthStateChanged,
         signOut }              from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore,
         doc, getDoc }          from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig,
         resolveRole,
         showNotification }     from "./config.js";

// 1. INITIALIZE
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let statusInterval = null;

// ============================================================
//  AUTH CHECK — redirect if not logged in
// ============================================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // Show email
    const userInfo = document.getElementById("user-info");
    const userEmail = document.getElementById("user-email");
    if (userInfo && userEmail) {
        userEmail.innerText  = user.email;
        userInfo.style.display = "block";
    }

    // Check status immediately on load
    await checkStatus(user);

    // Then check every 30 seconds automatically
    statusInterval = setInterval(() => checkStatus(user), 30000);
});

// ============================================================
//  CHECK ACCOUNT STATUS
// ============================================================
async function checkStatus(user) {
    const statusText = document.getElementById("status-text");
    const statusDot  = document.getElementById("status-bar")
                              ?.querySelector(".status-dot");

    try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (!userSnap.exists()) {
            updateStatus("Account not found. Contact your administrator.", "rejected");
            return;
        }

        const data   = userSnap.data();
        const status = data.accountStatus;
        const role   = resolveRole(data.role);

        if (status === "active") {
            // Approved! Stop polling and redirect
            clearInterval(statusInterval);
            updateStatus("✅ Account approved! Redirecting...", "approved");
            showNotification("Your account has been approved! Welcome.", "success");

            setTimeout(() => {
                if (role === "teacher") window.location.href = "teacher.html";
                else if (role === "admin") window.location.href = "admin.html";
                else window.location.href = "index.html";
            }, 2000);

        } else if (status === "suspended") {
            clearInterval(statusInterval);
            updateStatus("❌ Account rejected. Contact your administrator.", "rejected");

        } else {
            // Still pending
            const time = new Date().toLocaleTimeString();
            updateStatus(`Still pending approval — last checked at ${time}`, "pending");
        }

    } catch (err) {
        console.error("Status check error:", err);
        updateStatus("Could not check status. Will retry...", "pending");
    }
}

function updateStatus(message, type) {
    const statusText = document.getElementById("status-text");
    const statusDot  = document.querySelector(".status-dot");

    if (statusText) statusText.innerText = message;
    if (statusDot) {
        statusDot.className = "status-dot";
        if (type !== "pending") statusDot.classList.add(type);
    }
}

// ============================================================
//  WIRE UP BUTTONS
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    // Manual status check
    document.getElementById("btn-check-status")
        ?.addEventListener("click", async () => {
            const user = auth.currentUser;
            if (user) {
                showNotification("Checking status...", "info");
                await checkStatus(user);
            }
        });

    // Sign out
    document.getElementById("btn-sign-out")
        ?.addEventListener("click", async () => {
            clearInterval(statusInterval);
            await signOut(auth);
            window.location.href = "index.html";
        });
});