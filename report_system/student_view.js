import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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
        document.getElementById("student-welcome").innerText = `Results for ${user.email}`;

        try {
            // QUERY: Find reports where studentUid matches current user
            const q = query(collection(firestore, "reports"), where("studentUid", "==", user.uid));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                container.innerHTML = "<p>No results found yet. Please check back later.</p>";
                return;
            }

            let html = `<table border="1"><thead><tr><th>Date</th><th>Department</th><th>Scores</th><th>Total</th></tr></thead><tbody>`;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Format the scores object into a readable string
                const scoreDetails = Object.entries(data.scores)
                    .map(([subject, score]) => `${subject}: ${score}`)
                    .join(" | ");

                html += `<tr>
                    <td>${data.date}</td>
                    <td>${data.department}</td>
                    <td>${scoreDetails}</td>
                    <td><strong>${data.total}</strong></td>
                </tr>`;
            });

            html += "</tbody></table>";
            container.innerHTML = html;

        } catch (error) {
            console.error("Error fetching results:", error);
            container.innerHTML = "<p>Error loading results. Ensure you are authorized.</p>";
        }
    } else {
        window.location.href = "index.html";
    }
});