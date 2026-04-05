// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig, DEPARTMENTS, showNotification, MESSAGES } from "./config.js";

// 3. INITIALIZATION
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

let allStudents = [];
let currentTeacherUid = null;

// 4. AUTH & FILTERED STUDENT FETCHING
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentTeacherUid = user.uid;
        try {
            // UPDATED: Added where clause to filter by currentTeacherUid
            const q = query(
                collection(firestore, "users"), 
                where("role", "==", "student"),
                where("teacherId", "==", currentTeacherUid) 
            );
            
            const snap = await getDocs(q);
            allStudents = snap.docs.map(doc => ({ 
                id: doc.id, 
                name: `${doc.data().firstName} ${doc.data().lastName}` 
            }));
            
            console.log("Filtered students loaded for Exams:", allStudents.length);
        } catch (error) {
            console.error("Fetch error:", error);
            // Pro-tip: If you see an Index error in the console, click the link provided!
        }
    } else {
        window.location.href = "index.html";
    }
});

// 5. DYNAMIC SUBJECTS (Remains same)
window.updateExamSubjects = function() {
    const category = document.getElementById("exam-dept").value;
    const subjectsDropdown = document.getElementById("exam-subject");
    subjectsDropdown.innerHTML = '<option value="">-- Choose Subject --</option>';

    if (DEPARTMENTS[category]) {
        DEPARTMENTS[category].forEach(opt => {
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
    
    if (allStudents.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4'>No students found assigned to you.</td></tr>";
        return;
    }

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

// 7. CALCULATION (Remains same)
window.calcExam = function(input) {
    const row = input.closest('tr');
    const val = parseFloat(input.value) || 0;
    row.querySelector('.half-exam').value = (val * 0.5).toFixed(1);
};

// 8. SAVE LOGIC
window.saveExam = async function(studentId, btn) {
    const row = btn.closest('tr');
    if (!row) {
        showNotification("Error: Could not find row data", "error");
        return;
    }

    const rawScore = parseFloat(row.querySelector('.raw-exam')?.value) || 0;
    const scaledScore = parseFloat(row.querySelector('.half-exam')?.value) || 0;
    const dept = document.getElementById("exam-dept").value;
    const sub = document.getElementById("exam-subject").value;

    // Validation
    if (!rawScore || rawScore < 0 || rawScore > 100) {
        showNotification("Please enter a valid score between 0-100!", "error");
        return;
    }

    if (!dept || !sub) {
        showNotification("Please select both department and subject!", "error");
        return;
    }

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = MESSAGES.loading.saving;

    try {
        await addDoc(collection(firestore, "exams"), {
            teacherUid: currentTeacherUid,
            studentId: studentId,
            department: dept,
            subject: sub,
            rawScore: rawScore,
            scaledScore: scaledScore,
            timestamp: serverTimestamp()
        });

        btn.innerText = MESSAGES.success.saved;
        btn.style.background = "rgba(0, 255, 136, 0.2)";
        btn.style.color = "#00ff88";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
            btn.style.background = "";
            btn.style.color = "";
        }, 2000);
    } catch (error) {
        console.error("Save Error:", error);
        showNotification(MESSAGES.errors.save, "error");
        btn.disabled = false;
        btn.innerText = "Retry";
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