import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = { /* USE YOUR SAME CONFIG HERE */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get the ID from the URL
const params = new URLSearchParams(window.location.search);
const studentId = params.get('id');

async function loadProfile() {
    if (!studentId) return;

    // 1. Get Basic Student Info
    const studentDoc = await getDoc(doc(db, "users", studentId));
    if (studentDoc.exists()) {
        const sData = studentDoc.data();
        document.getElementById("prof-name").innerText = `${sData.firstName} ${sData.lastName}`;
        document.getElementById("prof-index").innerText = `Index: ${studentId}`;
    }

    // 2. Get Published Reports
    const q = query(collection(db, "published_reports"), where("studentId", "==", studentId));
    const querySnapshot = await getDocs(q);
    
    let total = 0, count = 0, html = "";

    querySnapshot.forEach((doc) => {
        const r = doc.data();
        total += parseFloat(r.total100);
        count++;
        html += `
            <div class="subject-card glass-panel">
                <h4>${r.subject}</h4>
                <p>SBA: ${r.sba50} | Exam: ${r.exam50}</p>
                <div class="grade-badge">${r.total100}%</div>
                <p>Grade: ${r.grade}</p>
            </div>`;
    });

    document.getElementById("results-container").innerHTML = html || "<p>No results published yet.</p>";
    if(count > 0) document.getElementById("prof-avg").innerText = `Overall Average: ${(total/count).toFixed(1)}%`;
}

loadProfile();