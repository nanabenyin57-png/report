// global.js - Global functions available immediately for HTML onclick handlers

// Navigation
window.toggleMenu = function() {
    const nav = document.getElementById("navover");
    if (nav) nav.classList.toggle("open");
};

// Sign-in/Sign-up (placeholders that will be overridden by modules)
window.signin_page = function() {
    // Placeholder - will be overridden by signing.js module
};

window.signup_page = function() {
    // Placeholder - will be overridden by signing.js module
};

window.handlesignin = function() {
    // Placeholder - will be overridden by signing.js module
};

window.handlesignup = function() {
    // Placeholder - will be overridden by signing.js module
};

// Assessment functions
window.calculate = function(element) {
    // Placeholder - will be overridden by assessment.js module
};

window.SBA = function() {
    // Placeholder - will be overridden by assessment.js module
};

window.saveSingleRow = function(button) {
    // Placeholder - will be overridden by assessment.js module
};

window.departmentchange = function() {
    // Placeholder - will be overridden by assessment.js module
};

// Exam functions
window.updateExamSubjects = function() {
    // Placeholder - will be overridden by exams.js module
};

window.generateExamRows = function() {
    // Placeholder - will be overridden by exams.js module
};

window.calcExam = function(input) {
    // Placeholder - will be overridden by exams.js module
};

window.saveExam = function(studentId, btn) {
    // Placeholder - will be overridden by exams.js module
};

// Student report functions
window.viewReportCard = function(studentId) {
    // Placeholder - will be overridden by studentREPORT.js module
};