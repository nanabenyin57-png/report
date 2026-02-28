// --- 1. GLOBAL EXPOSURE FIRST (Prevents ReferenceErrors) ---
window.toggleMenu = function() {
    const navOver = document.getElementById("navover");
    const navBtn = document.getElementById("navigation");
    if (navOver && navBtn) {
        navOver.classList.toggle("open");
        // This toggles the visual state of the hamburger icon
        navBtn.classList.toggle("is-active"); 
    }
};

// --- 2. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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

// --- 4. MAIN LOGIC ---
onAuthStateChanged(auth, async (user) => {
    const container = document.getElementById("results-container");
    const welcomeTxt = document.getElementById("student-welcome");

    if (user) {
        if (welcomeTxt) welcomeTxt.innerText = `Results for ${user.email}`;

        try {
            // This queries the specific reports tagged with this student's UID
            const q = query(collection(firestore, "reports"), where("studentUid", "==", user.uid));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                container.innerHTML = `
                    <div style="text-align:center; padding: 20px;">
                        <p>No results have been uploaded for your account yet.</p>
                        <p>Please contact your teacher.</p>
                    </div>`;
                return;
            }

            let html = `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Department</th>
                            <th>Subject Scores</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>`;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                // Format the scores into a nice readable list
                const scoreEntries = Object.entries(data.scores || {})
                    .map(([sub, score]) => `<span><strong>${sub}:</strong> ${score}</span>`)
                    .join(" | ");

                html += `
                    <tr>
                        <td>${data.date || 'N/A'}</td>
                        <td>${data.department || 'N/A'}</td>
                        <td class="score-cell">${scoreEntries}</td>
                        <td class="total-cell">${data.total || 0}</td>
                    </tr>`;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;

        } catch (error) {
            console.error("Firestore Error:", error);
            container.innerHTML = "<p style='color:red;'>Error fetching data. Please refresh.</p>";
        }
    } else {
        // Not logged in? Back to the start.
        window.location.href = "index.html";
    }
});