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
        // Trigger the filtered fetch as soon as we have the teacher's UID
        await fetchStudents(); 
    } else {
        window.location.href = "index.html"; 
    }
});

// UPDATED: Fetch students assigned ONLY to the current teacher
async function fetchStudents() {
    try {
        const q = query(
            collection(firestore, "users"), 
            where("role", "==", "student"),
            where("teacherId", "==", currentTeacherUid) // <--- The Ownership Filter
        );
        
        const querySnapshot = await getDocs(q);
        
        allStudents = querySnapshot.docs.map(doc => ({
            id: doc.id, 
            name: `${doc.data().firstName} ${doc.data().lastName}`
        }));
        
        console.log(`Success: Loaded ${allStudents.length} students assigned to you.`);
    } catch (error) {
        console.error("Error fetching filtered students:", error);
        // Reminder: If you get a "requires an index" error, click the link in your browser console.
    }
}

// 5. DYNAMIC SUBJECT POPULATION
window.departmentchange = function() {
    const category = document.getElementById("category").value;
    const subjects = document.getElementById("subjects");
    subjects.innerHTML = '<option value="">-- Choose Subject --</option>';

    if (DEPARTMENTS[category]) {
        DEPARTMENTS[category].forEach(opt => {
            const el = document.createElement("option");
            el.value = opt;
            el.textContent = opt;
            subjects.appendChild(el);
        });
    }
};

// 6. TABLE ROW GENERATION
window.SBA = function() {
    const studentCount = document.getElementById("studentcount").value;
    const tableHeader = document.getElementById("assessment_headerrow");
    const tableBody = document.getElementById("assessment_tablebody");

    if (allStudents.length === 0) {
        alert("No students found. Please register students first or check if the index is building.");
    }

    tableHeader.innerHTML = `
        <th>Select Student</th>
        <th>Ex. (15)</th>
        <th>Test (15)</th>
        <th>Proj. (15)</th>
        <th>Group (15)</th>
        <th>Total (60)</th>
        <th>Scale (50)</th>
        <th>Action</th>
    `;

    tableBody.innerHTML = "";

    let studentOptions = `<option value="">-- Choose Student --</option>`;
    allStudents.forEach(student => {
        studentOptions += `<option value="${student.id}">${student.name}</option>`;
    });

    for (let i = 0; i < studentCount; i++) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <select class="student-id-select">
                    ${studentOptions}
                </select>
            </td>
            <td><input type="number" class="class-exercise" oninput="window.calculate(this)" max="15"></td>
            <td><input type="number" class="class-test" oninput="window.calculate(this)" max="15"></td>
            <td><input type="number" class="project-work" oninput="window.calculate(this)" max="15"></td>
            <td><input type="number" class="group-work" oninput="window.calculate(this)" max="15"></td>
            <td><input type="number" class="total-score" readonly></td>
            <td><input type="text" class="scale-score" readonly></td>
            <td><button class="save-row-btn" onclick="window.saveSingleRow(this)">Save</button></td>
        `;
        tableBody.appendChild(row);
    }
};

// 7. CALCULATIONS
window.calculate = function(element) {
    const row = element.closest('tr');
    const getVal = (cls) => parseFloat(row.querySelector(cls).value) || 0;

    const total = getVal('.class-exercise') + getVal('.class-test') + 
                  getVal('.project-work') + getVal('.group-work');
    
    const scale = (total / 60) * 50;

    row.querySelector('.total-score').value = total.toFixed(1);
    row.querySelector('.scale-score').value = scale.toFixed(1);
};

// 8. SAVE LOGIC (Tagged with Teacher ID)
window.saveSingleRow = async function(button) {
    const row = button.closest('tr');
    if (!row) {
        showNotification("Error: Could not find row data", "error");
        return;
    }

    const dept = document.getElementById("category").value;
    const subject = document.getElementById("subjects").value;
    const studentSelect = row.querySelector('.student-id-select');
    const studentId = studentSelect ? studentSelect.value : '';
    const studentName = studentSelect ? studentSelect.options[studentSelect.selectedIndex]?.text : '';

    // Validation
    if (!studentId || !subject || dept === "Choose_A_Department") {
        showNotification("Please select a student, department, and subject!", "error");
        return;
    }

    // Validate scores
    const exercise = parseFloat(row.querySelector('.class-exercise')?.value) || 0;
    const test = parseFloat(row.querySelector('.class-test')?.value) || 0;
    const project = parseFloat(row.querySelector('.project-work')?.value) || 0;
    const group = parseFloat(row.querySelector('.group-work')?.value) || 0;

    if (exercise > 15 || test > 15 || project > 15 || group > 15) {
        showNotification("Individual scores cannot exceed 15 marks!", "error");
        return;
    }

    button.disabled = true;
    const originalText = button.innerText;
    button.innerText = MESSAGES.loading.saving;

    try {
        await addDoc(collection(firestore, "assessments"), {
            teacherUid: currentTeacherUid,
            studentId: studentId,
            studentName: studentName,
            department: dept,
            subject: subject,
            scores: {
                exercise: exercise,
                test: test,
                project: project,
                group: group
            },
            total60: row.querySelector('.total-score').value,
            scaled50: row.querySelector('.scale-score').value,
            timestamp: serverTimestamp()
        });

        button.innerText = MESSAGES.success.saved;
        button.style.backgroundColor = "rgba(0, 255, 136, 0.3)";
        button.style.color = "#00ff88";
        setTimeout(() => {
            button.innerText = originalText;
            button.disabled = false;
            button.style.backgroundColor = "";
            button.style.color = "";
        }, 2000);
    } catch (error) {
        console.error("Save Error:", error);
        showNotification(MESSAGES.errors.save, "error");
        button.disabled = false;
        button.innerText = "Retry";
    }
};
    
    const studentSelect = row.querySelector('.student-id-select');
    const studentId = studentSelect.value;
    const studentName = studentSelect.options[studentSelect.selectedIndex].text;

    if (!studentId || !subject || dept === "Choose_A_Department") {
        alert("Please select a student, department, and subject!");
        return;
    }

    button.disabled = true;
    button.innerText = "...";

    try {
        await addDoc(collection(firestore, "assessments"), {
            teacherUid: currentTeacherUid, // Data ownership
            studentId: studentId, 
            studentName: studentName,
            department: dept,
            subject: subject,
            scores: {
                exercise: row.querySelector('.class-exercise').value || 0,
                test: row.querySelector('.class-test').value || 0,
                project: row.querySelector('.project-work').value || 0,
                group: row.querySelector('.group-work').value || 0
            },
            total60: row.querySelector('.total-score').value,
            scaled50: row.querySelector('.scale-score').value,
            timestamp: serverTimestamp()
        });

        button.innerText = "Saved";
        button.style.backgroundColor = "rgba(0, 255, 136, 0.3)";
        button.style.color = "#00ff88";
    } catch (e) {
        console.error("Save Error:", e);
        button.disabled = false;
        button.innerText = "Retry";
        alert("Failed to save. Check browser console for index link.");
    }
};