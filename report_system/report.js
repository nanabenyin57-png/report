// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { firebaseConfig, calculateGrade, showNotification, MESSAGES, CLASSES, STREAM_PATTERNS, generateStreams } from "./config.js";

// 2. INITIALIZATION
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

let allStudents = []; 
let currentTeacherUid = null;

// 4. AUTH OBSERVER
onAuthStateChanged(auth, async (user) => {
    const adminSec = document.getElementById("admin-section");
    const statusMsg = document.getElementById("status-msg");

    if (user) {
        currentTeacherUid = user.uid;
        try {
            const userDoc = await getDoc(doc(firestore, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.role === "admin" || userData.role === "teacher") {
                    if (adminSec) adminSec.style.display = "block";
                    statusMsg.innerText = `Welcome, ${userData.firstName} (Staff)`;
                    await fetchStudents(); 
                } else {
                    window.location.href = "student_report.html"; 
                }
            }
        } catch (error) {
            console.error("Auth error:", error);
        }
    } else { 
        window.location.href = "index.html"; 
    }
});

// 5. FETCH STUDENTS
async function fetchStudents() {
    try {
        const q = query(
            collection(firestore, "users"), 
            where("role", "==", "student"),
            where("teacherId", "==", currentTeacherUid) 
        );
        
        const querySnapshot = await getDocs(q);
        allStudents = querySnapshot.docs.map(doc => ({
            uid: doc.id, 
            name: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim(),
            department: doc.data().department || '',
            class: doc.data().class || '',
            stream: doc.data().stream || ''
        }));
        console.log(`Success: Loaded ${allStudents.length} students.`);
    } catch (error) {
        console.error("Error fetching students:", error);
    }
}

// 5a. UPDATE CLASS DROPDOWN
window.updateClassDropdown = function() {
    const deptSelect = document.getElementById("department");
    const classSelect = document.getElementById("class-select");
    const streamCountSelect = document.getElementById("stream-count");
    const streamSelect = document.getElementById("stream-select");
    
    const selectedDept = deptSelect.value;

    classSelect.innerHTML = '<option value="choose_a_class">-- Select Class --</option>';
    streamCountSelect.innerHTML = '<option value="">-- Select Streams --</option>';
    streamSelect.innerHTML = '<option value="choose_a_stream">-- Select Stream --</option>';

    if (selectedDept !== "choose_a_department" && CLASSES[selectedDept]) {
        CLASSES[selectedDept].forEach(classOption => {
            const el = document.createElement("option");
            el.value = classOption;
            el.innerText = classOption;
            classSelect.appendChild(el);
        });
    }
};

// 5b. UPDATE STREAM COUNT DROPDOWN
window.updateStreamCountDropdown = function() {
    const streamCountSelect = document.getElementById("stream-count");
    const streamSelect = document.getElementById("stream-select");
    
    streamCountSelect.innerHTML = '<option value="">-- Select Streams --</option>';
    streamSelect.innerHTML = '<option value="choose_a_stream">-- Select Stream --</option>';
    
    for (let i = 1; i <= 5; i++) {
        const el = document.createElement("option");
        el.value = i;
        el.innerText = i + " Stream" + (i > 1 ? "s" : "");
        streamCountSelect.appendChild(el);
    }
};

// 5c. UPDATE STREAM DROPDOWN
window.updateStreamDropdown = function() {
    const classSelect = document.getElementById("class-select");
    const streamCountSelect = document.getElementById("stream-count");
    const streamSelect = document.getElementById("stream-select");
    
    const selectedClass = classSelect.value;
    const numStreams = parseInt(streamCountSelect.value) || 0;
    
    streamSelect.innerHTML = '<option value="choose_a_stream">-- Select Stream --</option>';
    
    if (selectedClass !== "choose_a_class" && numStreams > 0) {
        const streams = generateStreams(selectedClass, numStreams);
        streams.forEach(stream => {
            const el = document.createElement("option");
            el.value = stream;
            el.innerText = stream;
            streamSelect.appendChild(el);
        });
    }
};

// 6. REGISTER NEW STUDENT
window.registerStudent = async function() {
    const indexNo = document.getElementById("reg-index").value.trim();
    const fname = document.getElementById("reg-fname").value.trim();
    const lname = document.getElementById("reg-lname").value.trim();
    const department = document.getElementById("reg-department").value.trim();
    const cls = document.getElementById("reg-class").value.trim();
    const streamCount = document.getElementById("reg-stream-count").value.trim();
    const stream = document.getElementById("reg-stream").value.trim();
    const status = document.getElementById("reg-status");

    if (!indexNo || !fname || !lname || !department || !cls || !streamCount || !stream) {
        return alert("Please fill all fields including Department, Class, Stream Count, and Stream!");
    }

    status.innerText = "Creating Profile...";
    try {
        await setDoc(doc(firestore, "users", indexNo), {
            firstName: fname,
            lastName: lname,
            indexNo: indexNo,
            role: "student",
            department: department,
            class: cls,
            stream: stream,
            teacherId: currentTeacherUid, 
            createdAt: serverTimestamp()
        });
        
        status.style.color = "#00ff88";
        status.innerText = `Success: ${indexNo} Registered`;
        await fetchStudents(); 
    } catch (e) {
        console.error(e);
        status.innerText = "Registration Error.";
    }
};

// 6a. UPDATE REGISTRATION CLASS DROPDOWN
window.updateRegClassDropdown = function() {
    const deptSelect = document.getElementById("reg-department");
    const classSelect = document.getElementById("reg-class");
    const streamCountSelect = document.getElementById("reg-stream-count");
    const streamSelect = document.getElementById("reg-stream");
    
    const selectedDept = deptSelect.value;

    classSelect.innerHTML = '<option value="">-- Select Class --</option>';
    streamCountSelect.innerHTML = '<option value="">-- Select Streams --</option>';
    streamSelect.innerHTML = '<option value="">-- Select Stream --</option>';

    if (selectedDept !== "" && CLASSES[selectedDept]) {
        CLASSES[selectedDept].forEach(classOption => {
            const el = document.createElement("option");
            el.value = classOption;
            el.innerText = classOption;
            classSelect.appendChild(el);
        });
    }
};

// 6b. UPDATE REGISTRATION STREAM COUNT DROPDOWN
window.updateRegStreamCountDropdown = function() {
    const streamCountSelect = document.getElementById("reg-stream-count");
    const streamSelect = document.getElementById("reg-stream");
    
    streamCountSelect.innerHTML = '<option value="">-- Select Streams --</option>';
    streamSelect.innerHTML = '<option value="">-- Select Stream --</option>';
    
    for (let i = 1; i <= 5; i++) {
        const el = document.createElement("option");
        el.value = i;
        el.innerText = i + " Stream" + (i > 1 ? "s" : "");
        streamCountSelect.appendChild(el);
    }
};

// 6c. UPDATE REGISTRATION STREAM DROPDOWN
window.updateRegStreamDropdown = function() {
    const classSelect = document.getElementById("reg-class");
    const streamCountSelect = document.getElementById("reg-stream-count");
    const streamSelect = document.getElementById("reg-stream");
    
    const selectedClass = classSelect.value;
    const numStreams = parseInt(streamCountSelect.value) || 0;
    
    streamSelect.innerHTML = '<option value="">-- Select Stream --</option>';
    
    if (selectedClass !== "" && numStreams > 0) {
        const streams = generateStreams(selectedClass, numStreams);
        streams.forEach(stream => {
            const el = document.createElement("option");
            el.value = stream;
            el.innerText = stream;
            streamSelect.appendChild(el);
        });
    }
};

// 7. COMPILATION LOGIC (50/50 JOIN)
window.generateFinalReport = async function() {
    const tablebody = document.getElementById("tablebody");
    const dept = document.getElementById("department").value;
    const classVal = document.getElementById("class-select").value;
    const stream = document.getElementById("stream-select").value;

    if (dept === "choose_a_department" || classVal === "choose_a_class" || stream === "choose_a_stream") {
        showNotification("Please select Department, Class, and Stream!", "error");
        return;
    }

    tablebody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Merging Data...</td></tr>";

    try {
        let reportHTML = "";

        for (let student of allStudents) {
            // Filter students by department, class, and stream
            if (student.department !== dept || student.class !== classVal || student.stream !== stream) {
                continue;
            }

            const [sbaSnap, examSnap] = await Promise.all([
                getDocs(query(collection(firestore, "assessments"), where("studentId", "==", student.uid))),
                getDocs(query(collection(firestore, "exams"), where("studentId", "==", student.uid)))
            ]);

            const sbaScores = {};
            sbaSnap.forEach(doc => {
                const data = doc.data();
                if (data.department === dept) {
                    sbaScores[data.subject] = parseFloat(data.scaled50) || 0;
                }
            });

            const examScores = {};
            examSnap.forEach(doc => {
                const data = doc.data();
                if (data.department === dept) {
                    examScores[data.subject] = parseFloat(data.scaledScore) || 0;
                }
            });

            const subjects = [...new Set([...Object.keys(sbaScores), ...Object.keys(examScores)])];

            subjects.forEach(sub => {
                const sba = sbaScores[sub] || 0;
                const exam = examScores[sub] || 0;
                const total = sba + exam;

                reportHTML += `
                    <tr>
                        <td>
                            <button class="view-card-btn" onclick="window.viewReportCard('${student.uid}')">
                                ${student.name}
                            </button>
                        </td>
                        <td>${sub}</td>
                        <td>${sba.toFixed(1)}</td>
                        <td>${exam.toFixed(1)}</td>
                        <td style="color:#00e5ff; font-weight:bold;">${total.toFixed(1)}</td>
                        <td>${calculateGrade(total)}</td>
                    </tr>
                `;
            });
        }
        tablebody.innerHTML = reportHTML || "<tr><td colspan='6'>No records found.</td></tr>";
    } catch (error) {
        console.error("Compilation Error:", error);
        showNotification(MESSAGES.errors.network, "error");
        tablebody.innerHTML = "<tr><td colspan='6' style='text-align:center; color: #ff4444;'>Error loading data. Please try again.</td></tr>";
    }
};

// 8. PUBLISH TO STUDENTS
window.publishToStudents = async function() {
    const rows = document.querySelectorAll("#tablebody tr");
    const dept = document.getElementById("department").value;
    const classVal = document.getElementById("class-select").value;
    const stream = document.getElementById("stream-select").value;

    if (rows.length === 0 || rows[0].cells.length < 6) {
        showNotification("Generate report first!", "error");
        return;
    }

    const btn = document.getElementById("btnSave");
    const originalText = btn.innerText;
    btn.innerText = MESSAGES.loading.publishing;
    btn.disabled = true;

    try {
        for (let row of rows) {
            const cells = row.cells;
            if (cells.length < 6) continue; // Skip invalid rows

            const studentName = cells[0].innerText;
            const subject = cells[1].innerText;
            const sba = parseFloat(cells[2].innerText) || 0;
            const exam = parseFloat(cells[3].innerText) || 0;
            const total = parseFloat(cells[4].innerText) || 0;
            const grade = cells[5].innerText;

            const student = allStudents.find(s => s.name === studentName);
            if (!student) {
                console.warn(`Student not found: ${studentName}`);
                continue;
            }

            await setDoc(doc(firestore, "published_reports", `${student.uid}_${subject}_${dept}`), {
                studentId: student.uid,
                studentName: studentName,
                department: dept,
                class: classVal,
                stream: stream,
                subject: subject,
                sba50: sba.toFixed(1),
                exam50: exam.toFixed(1),
                total100: total.toFixed(1),
                grade: grade,
                publishedAt: serverTimestamp(),
                teacherId: currentTeacherUid
            });
        }

        showNotification(MESSAGES.success.published, "success");
        btn.innerText = originalText;
        btn.disabled = false;
    } catch (error) {
        console.error("Publish Error:", error);
        showNotification(MESSAGES.errors.save, "error");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// 10. UI & NAVIGATION HANDLERS
window.viewReportCard = function(studentId) {
    if (!studentId) return alert("Student ID not found.");
    window.location.href = `student_report.html?id=${studentId}`;
};

// 11. EVENT LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnGenerate")?.addEventListener("click", window.generateFinalReport);
    document.getElementById("btnRegisterStudent")?.addEventListener("click", window.registerStudent);
    document.getElementById("btnSave")?.addEventListener("click", window.publishToStudents);
}); 
