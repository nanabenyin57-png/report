// --- 1. GLOBAL EXPOSURE (Move to the very top) ---
window.toggleMenu = function() {
    const navOver = document.getElementById("navover");
    const navBtn = document.getElementById("navigation");
    if (navOver && navBtn) {
        navOver.classList.toggle("open");
        navBtn.classList.toggle("is-active");
    }
};

// --- 2. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- 3. CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
  authDomain: "reportbase-669ff.firebaseapp.com",
  projectId: "reportbase-669ff",
  storageBucket: "reportbase-669ff.firebasestorage.app",
  messagingSenderId: "244941864396",
  appId: "1:244941864396:web:aebc946e160a0172edf169"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

// --- 4. DATA FETCHING ---
onAuthStateChanged(auth, async (user) => {
    const container = document.getElementById("results-container");
    const welcomeTxt = document.getElementById("student-welcome");

    if (user) {
        if (welcomeTxt) welcomeTxt.innerText = `Results for ${user.email}`;

        try {
            // Updated Query: Looking specifically for the studentUid field
            const reportsRef = collection(firestore, "reports");
            const q = query(reportsRef, where("studentUid", "==", user.uid));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                container.innerHTML = `
                    <div style="background: rgba(0,0,0,0.5); color: white; padding: 20px; border-radius: 8px;">
                        <h3>No Results Found</h3>
                        <p>Your UID: <code style="color: #00ff00;">${user.uid}</code></p>
                        <p>Please ensure the teacher selected your name from the dropdown when saving.</p>
                    </div>`;
                return;
            }

            let tableHTML = `
                <table class="report-table" style="width:100%; border-collapse: collapse; background: white; color: black;">
                    <thead>
                        <tr style="background: #333; color: white;">
                            <th>Date</th>
                            <th>Subject Scores</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>`;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const scores = Object.entries(data.scores || {})
                    .map(([sub, val]) => `<strong>${sub}:</strong> ${val}`)
                    .join(" | ");

                tableHTML += `
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 10px;">${data.date || 'N/A'}</td>
                        <td style="padding: 10px;">${scores}</td>
                        <td style="padding: 10px; font-weight: bold;">${data.total || 0}</td>
                    </tr>`;
            });

            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;

        } catch (error) {
            console.error("Fetch Error:", error);
            container.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        }
    } else {
        window.location.href = "index.html";
    }
});