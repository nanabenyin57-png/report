// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig, DEPARTMENTS, CLASSES, STREAM_PATTERNS, generateStreams, showNotification, MESSAGES } from "./config.js";

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
                name: `${doc.data().firstName} ${doc.data().lastName}`,
                department: doc.data().department || '',
                class: doc.data().class || '',
                stream: doc.data().stream || ''
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

// 5. DYNAMIC SUBJECTS AND CLASSES
window.updateExamSubjects = function() {
    const category = document.getElementById("exam-dept").value;
    const classDropdown = document.getElementById("exam-class");
    const streamCountDropdown = document.getElementById("exam-stream-count");
    const streamDropdown = document.getElementById("exam-stream");
    const subjectsDropdown = document.getElementById("exam-subject");
    
    // Update classes
    classDropdown.innerHTML = '<option value="">-- Select Class --</option>';
    if (CLASSES[category]) {
        CLASSES[category].forEach(cls => {
            const el = document.createElement("option");
            el.value = cls;
            el.textContent = cls;
            classDropdown.appendChild(el);
        });
    }
    
    // Stream count options
    streamCountDropdown.innerHTML = '<option value="">-- Select Streams --</option>';
    for (let i = 1; i <= 5; i++) {
        const el = document.createElement("option");
        el.value = i;
        el.textContent = i + " Stream" + (i > 1 ? "s" : "");
        streamCountDropdown.appendChild(el);
    }
    
    // Update streams if class and stream count are selected
    const selectedClass = classDropdown.value;
    const numStreams = parseInt(streamCountDropdown.value) || 0;
    
    streamDropdown.innerHTML = '<option value="">-- Select Stream --</option>';
    if (selectedClass !== "" && numStreams > 0) {
        const streams = generateStreams(selectedClass, numStreams);
        streams.forEach(stream => {
            const el = document.createElement("option");
            el.value = stream;
            el.textContent = stream;
            streamDropdown.appendChild(el);
        });
    }
    
    // Update subjects
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
    const cls = document.getElementById("exam-class").value;
    const stream = document.getElementById("exam-stream").value;
    const sub = document.getElementById("exam-subject").value;

    if (!dept || !cls || !stream || !sub) {
        alert("Please select Department, Class, Stream, and Subject first!");
        return;
    }

    tbody.innerHTML = "";
    
    // Filter students by department, class, and stream
    const filteredStudents = allStudents.filter(s => s.department === dept && s.class === cls && s.stream === stream);
    
    if (filteredStudents.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4'>No students found in this department, class, and stream.</td></tr>";
        return;
    }

    filteredStudents.forEach(student => {
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
    const cls = document.getElementById("exam-class").value;
    const stream = document.getElementById("exam-stream").value;
    const sub = document.getElementById("exam-subject").value;

    // Validation
    if (!rawScore || rawScore < 0 || rawScore > 100) {
        showNotification("Please enter a valid score between 0-100!", "error");
        return;
    }

    if (!dept || !cls || !stream || !sub) {
        showNotification("Please select department, class, stream, and subject!", "error");
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
            class: cls,
            stream: stream,
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
document.addEventListener("DOMContentLoaded", () => {
    const loadBtn = document.getElementById("btnLoadExams");
    if (loadBtn) {
        loadBtn.onclick = window.generateExamRows;
    }
});