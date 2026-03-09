import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// (Your Firebase Config here...)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

let allStudents = [];

// 1. Fetch Students
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const q = query(collection(firestore, "users"), where("role", "==", "student"));
        const snap = await getDocs(q);
        allStudents = snap.docs.map(doc => ({ id: doc.id, name: `${doc.data().firstName} ${doc.data().lastName}` }));
    } else {
        window.location.href = "index.html";
    }
});

// 2. Populate Table
window.generateExamRows = function() {
    const tbody = document.getElementById("exam-body");
    tbody.innerHTML = "";

    allStudents.forEach(student => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${student.name}</td>
            <td><input type="number" class="raw-exam" oninput="window.calcExam(this)" max="100"></td>
            <td><input type="number" class="half-exam" readonly></td>
            <td><button class="save-row-btn" onclick="window.saveExam('${student.id}', this)">Save</button></td>
        `;
        tbody.appendChild(tr);
    });
};

// 3. Calculation
window.calcExam = function(input) {
    const row = input.closest('tr');
    const val = parseFloat(input.value) || 0;
    row.querySelector('.half-exam').value = (val * 0.5).toFixed(1);
};

// 4. Save to Firebase
window.saveExam = async function(studentId, btn) {
    const row = btn.closest('tr');
    const score = row.querySelector('.raw-exam').value;
    const dept = document.getElementById("exam-dept").value;
    const sub = document.getElementById("exam-subject").value;

    if(!score || !sub) return alert("Fill score and subject!");

    btn.disabled = true;
    try {
        await addDoc(collection(firestore, "exams"), {
            studentId,
            department: dept,
            subject: sub,
            rawScore: score,
            scaledScore: (score * 0.5).toFixed(1),
            timestamp: serverTimestamp()
        });
        btn.innerText = "Saved";
        btn.style.background = "rgba(0, 255, 136, 0.2)";
    } catch (e) {
        btn.disabled = false;
        alert("Error saving.");
    }
};

// Expose functions
document.getElementById("btnLoadExams").onclick = window.generateExamRows;
window.toggleMenu = () => document.getElementById("navover").classList.toggle("open");