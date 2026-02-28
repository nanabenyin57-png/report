import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- MOVE THIS TO THE TOP ---
function toggleMenu() {
    const navOver = document.getElementById("navover");
    const navBtn = document.getElementById("navigation");
    if (navOver && navBtn) {
        navOver.classList.toggle("open");
        navBtn.classList.toggle("is-active");
    }
}
window.toggleMenu = toggleMenu; 
// ----------------------------

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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const container = document.getElementById("results-container");
        const welcomeTxt = document.getElementById("student-welcome");
        
        if(welcomeTxt) welcomeTxt.innerText = `Results for ${user.email}`;

        try {
            const q = query(collection(firestore, "reports"), where("studentUid", "==", user.uid));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                if(container) container.innerHTML = "<p>No results found yet. Please check back later.</p>";
                return;
            }

            let html = `<table border="1" class="results-table">
                        <thead><tr><th>Date</th><th>Department</th><th>Scores</th><th>Total</th></tr></thead>
                        <tbody>`;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const scoreDetails = Object.entries(data.scores || {})
                    .map(([subject, score]) => `<strong>${subject}:</strong> ${score}`)
                    .join(" | ");

                html += `<tr>
                    <td>${data.date || 'N/A'}</td>
                    <td>${data.department || 'N/A'}</td>
                    <td>${scoreDetails}</td>
                    <td><strong>${data.total || 0}</strong></td>
                </tr>`;
            });

            html += "</tbody></table>";
            if(container) container.innerHTML = html;

        } catch (error) {
            console.error("Error fetching results:", error);
            if(container) container.innerHTML = "<p style='color:red;'>Error loading results. Check Firestore Rules.</p>";
        }
    } else {
        window.location.href = "index.html";
    }
});