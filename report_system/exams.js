// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// 2. CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBmlZD5EHWgt8DsocsPVZcf4MJVjeuC0Fw",
  authDomain: "reportbase-669ff.firebaseapp.com",
  projectId: "reportbase-669ff",
  storageBucket: "reportbase-669ff.firebasestorage.app",
  messagingSenderId: "244941864396",
  appId: "1:244941864396:web:aebc946e160a0172edf169",
  measurementId: "G-KBTRR8YZFJ"
};

// 3. INITIALIZATION
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

let allStudents = [];
let currentTeacherUid = null;

// 4. AUTH & STUDENT FETCHING
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentTeacherUid = user.uid;
        try {
            const q = query(collection(firestore, "users"), where("role", "==", "student"));
            const snap = await getDocs(q);
            allStudents = snap.docs.map(doc => ({ 
                id: doc.id, 
                name: `${doc.data().firstName} ${doc.data().lastName}` 
            }));
            console.log("Students loaded for Exams:", allStudents.length);
        } catch (error) {
            console.error("Fetch error:", error);
        }
    } else {
        window.location.href = "index.html";
    }
});

// 5. DYNAMIC SUBJECTS (Refined)
window.updateExamSubjects = function() {
    const category = document.getElementById("exam-dept").value;
    const subjectsDropdown = document.getElementById("exam-subject");
    subjectsDropdown.innerHTML = '<option value="">-- Choose Subject --</option>';

    const subjectData = {
        "Preschool": ["Numeracy", "Literacy", "Creative Arts", "Our World"],
        "LowerPrimary": ["English", "Maths", "Science", "History", "Our World", "RME", "Twi"],
        "UpperPrimary": ["English", "Maths", "Science", "History", "Computing", "RME", "Twi"],
        "JuniorHigh": ["English", "Maths", "Science", "Social Studies", "Computing", "Pre-Tech", "RME", "Twi"]
    };

    if (subjectData[category]) {
        subjectData[category].forEach(opt => {
            const el = document.createElement("option");
            el.value = opt;
            el.textContent = opt;
            subjectsDropdown.appendChild(el);
        });
    }
};

// 6. TABLE GENERATION
window.generateExamRows = function() {
    const tbody = document.getElementById("exam-body");
    const dept = document.getElementById("exam-dept").value;
    const sub = document.getElementById("exam-subject").value;

    if (!dept || !sub) {
        alert("Please select both Department and Subject first!");
        return;
    }

    tbody.innerHTML = "";
    allStudents.forEach(student => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${student.name}</td>
            <td><input type="number" class="raw-exam" oninput="window.calcExam(this)" max="100" placeholder="0-100"></td>
            <td><input type="number" class="half-exam" readonly placeholder="50%"></td>
            <td><button class="save-row-btn" onclick="window.saveExam('${student.id}', this)">Save</button></td>
        `;
        tbody.appendChild(tr);
    });
};

// 7. CALCULATION
window.calcExam = function(input) {
    const row = input.closest('tr');
    const val = parseFloat(input.value) || 0;
    // Auto-calculates the 50% weight for the final report
    row.querySelector('.half-exam').value = (val * 0.5).toFixed(1);
};

// 8. SAVE LOGIC
window.saveExam = async function(studentId, btn) {
    const row = btn.closest('tr');
    const rawScore = row.querySelector('.raw-exam').value;
    const scaledScore = row.querySelector('.half-exam').value;
    const dept = document.getElementById("exam-dept").value;
    const sub = document.getElementById("exam-subject").value;

    if (!rawScore) return alert("Enter a score before saving!");

    btn.disabled = true;
    btn.innerText = "...";

    try {
        await addDoc(collection(firestore, "exams"), {
            teacherUid: currentTeacherUid,
            studentId: studentId,
            department: dept,
            subject: sub,
            rawScore: parseFloat(rawScore),
            scaledScore: parseFloat(scaledScore),
            timestamp: serverTimestamp()
        });
        
        btn.innerText = "Saved";
        btn.style.background = "rgba(0, 255, 136, 0.2)";
        btn.style.color = "#00ff88";
    } catch (e) {
        console.error("Save Error:", e);
        btn.disabled = false;
        btn.innerText = "Retry";
        alert("Permission denied. Check Firestore rules.");
    }
};

// 9. MENU & EVENT LISTENERS
window.toggleMenu = () => document.getElementById("navover").classList.toggle("open");

document.addEventListener("DOMContentLoaded", () => {
    const loadBtn = document.getElementById("btnLoadExams");
    if (loadBtn) {
        loadBtn.onclick = window.generateExamRows;
    }
});