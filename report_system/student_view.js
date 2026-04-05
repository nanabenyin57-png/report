// --- 2. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig, showNotification, MESSAGES } from "./config.js";

// --- 3. CONFIG ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

// --- 4. DATA FETCHING ---
onAuthStateChanged(auth, async (user) => {
    const container = document.getElementById("results-container");
    const welcomeTxt = document.getElementById("student-welcome");

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    if (welcomeTxt) welcomeTxt.innerText = `Results for ${user.email}`;

    try {
        // Updated Query: Looking specifically for the studentUid field
        const reportsRef = collection(firestore, "published_reports");
        const q = query(reportsRef, where("studentId", "==", user.uid), orderBy("publishedAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = `
                <div style="background: rgba(0,0,0,0.5); color: white; padding: 20px; border-radius: 8px;">
                    <h3>No Results Found</h3>
                    <p>Your teacher hasn't published your results yet.</p>
                    <p>Please check back later or contact your teacher.</p>
                </div>`;
            return;
        }

        let tableHTML = `
            <table class="report-table" style="width:100%; border-collapse: collapse; background: white; color: black;">
                <thead>
                    <tr style="background: #333; color: white;">
                        <th>Subject</th>
                        <th>Class Score (50%)</th>
                        <th>Exam Score (50%)</th>
                        <th>Total (100%)</th>
                        <th>Grade</th>
                        <th>Published</th>
                    </tr>
                </thead>
                <tbody>`;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const total = parseFloat(data.total100) || 0;
            const publishedDate = data.publishedAt?.toDate()?.toLocaleDateString() || 'N/A';

            tableHTML += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px; font-weight: bold;">${data.subject || 'N/A'}</td>
                    <td style="padding: 10px;">${data.sba50 || '0'}</td>
                    <td style="padding: 10px;">${data.exam50 || '0'}</td>
                    <td style="padding: 10px; font-weight: bold; color: #00e5ff;">${total.toFixed(1)}</td>
                    <td style="padding: 10px;">${data.grade || 'N/A'}</td>
                    <td style="padding: 10px;">${publishedDate}</td>
                </tr>`;
        });

        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;

    } catch (error) {
        console.error("Fetch Error:", error);
        showNotification(MESSAGES.errors.network, "error");
        container.innerHTML = `<p style="color:red; padding: 20px;">Error loading results. Please try again later.</p>`;
    }
});