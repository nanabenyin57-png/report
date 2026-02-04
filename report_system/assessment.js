 function toggleMenu(){
    const overlay = document.getElementById("navover");
    const humburger= document.getElementById("navigation");
    overlay.classList.toggle("open");
    humburger.classList.toggle("is-active");
 }
 function departmentchange(){
    const department= document.getElementById("category").value;
    const subjectlist= document.getElementById("subjects");
    let options=`<option value="">Select Subject</option>`;
    if(department==="Preschool"){
        options+= `<option value="LITERACY">LITERACY</option>
        <option value="NUMERACY">NUMERACY</option>
        <option value="CREATIVE_ARTS">CREATIVE ARTS</option>
        <option value="WRITING">WRITING</option>`;
    }
    else if(department==="LowerPrimary"){
        options+= `<option value="ENGLISH">ENGLISH</option>
        <option value="MATHS">MATHS</option>
        <option value="SCIENCE">SCIENCE</option>
        <option value="HISTORY">HISTORY</option>
        <option value="RELIGIOUS_EDUCATION">RELIGIOUS EDUCATION</option>
        <option value="CREATIVE_ARTS">CREATIVE ARTS</option>
        <option value="FRENCH">FRENCH</option>
        <option value="TWI">TWI</option>`;
    }   
    else if(department==="UpperPrimary"){
        options+= `<option value="ENGLISH">ENGLISH</option>
        <option value="MATHS">MATHS</option>
        <option value="SCIENCE">SCIENCE</option>
        <option value="COMPUTING">COMPUTING</option>
        <option value="HISTORY">HISTORY</option>
        <option value="RELIGIOUS_EDUCATION">RELIGIOUS EDUCATION</option>
        <option value="CREATIVE_ARTS">CREATIVE ARTS</option>
        <option value="FRENCH">FRENCH</option>
        <option value="TWI">TWI</option>`;
    }
    else if(department==="JuniorHigh"){
        options+= `<option value="ENGLISH">ENGLISH</option>
        <option value="MATHS">MATHS</option>
        <option value="SCIENCE">SCIENCE</option>
        <option value="COMPUTING">COMPUTING</option>
        <option value="SOCIAL_STUDIES">SOCIAL STUDIES</option>
        <option value="RELIGIOUS_EDUCATION">RELIGIOUS EDUCATION</option>
        <option value="CREATIVE_ARTS">CREATIVE ARTS</option>
        <option value="FRENCH">FRENCH</option>
        <option value="TWI">TWI</option>
        <option value="CAREER_TECHNOLOGY">CAREER TECHNOLOGY</option>`;
    }
    else{
        options=`<option value="">Select Department First</option>`;
    }
    subjectlist.innerHTML= options;
 }
 function SBA() {
    const subjectlist = document.getElementById("subjects");
    if (!subjectlist || subjectlist.selectedIndex === -1) return;

    const count = document.getElementById("studentcount").value || 0;
    const thead = document.getElementById("assessment_headerrow");
    const tbody = document.getElementById("assessment_tablebody");

    // Set Header
    thead.innerHTML = `<tr>
        <th>STUDENT NAME</th>
        <th>CLASS SCORE</th>
        <th>GROUP WORK</th>
        <th>CLASS TEST</th>
        <th>PROJECT WORK</th>
        <th>TOTAL</th>
    </tr>`;

    // Build the rows in a single variable
    let allRows = "";
    if (subjectlist.value !== "") {
        for (let i = 0; i < count; i++) {
            allRows += `<tr>
                <td><input type="text" id="student_name_${i}" name="STUDENT_NAME[]" required></td>
                <td><input type="number" id="class_score_${i}" name="CLASS_SCORE[]" class="score" oninput="calculateRowTotal(this)" min="0" max="15" required></td>
                <td><input type="number" id="group_work_${i}" name="GROUP_WORK[]" class="score" oninput="calculateRowTotal(this)" min="0" max="15" required></td>
                <td><input type="number" id="class_test_${i}" name="CLASS_TEST[]" class="score" oninput="calculateRowTotal(this)" min="0" max="15" required></td>
                <td><input type="number" id="project_work_${i}" name="PROJECT_WORK[]" class="score" oninput="calculateRowTotal(this)" min="0" max="15" required></td>
                <td><input type="number" id="total_${i}" name="TOTAL[]" class="total-box" readonly></td>
            </tr>`;
        }
        tbody.innerHTML = allRows;
    } else {
        tbody.innerHTML = `<tr><td colspan="6">Please Select A Subject</td></tr>`;
    }
};

 //function to calculate total score for each row
    function calculateRowTotal(input) {
        const row = input.closest('tr');
        const scores = row.querySelectorAll('.score');
        var sum = 0;
        scores.forEach((score) => {
            const value = Number(score.value) || 0;
            sum += value;
        });
        row.querySelector('.total-box').value = sum;
    }
       

document.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        const currentInput = e.target;
        if (currentInput.tagName !== "INPUT") return;

        const table = currentInput.closest("table");
        if (!table) return;

        // Block the default "Form Submit/Reload"
        e.preventDefault();

        // 1. Get every single input in this table
        const allInputs = Array.from(table.querySelectorAll('input:not([readonly])'));
        
        // 2. Find the index of the input we are currently in
        const currentIndex = allInputs.indexOf(currentInput);

        // 3. How many columns are there? (Usually 5 for your SBA)
        // We find this by looking at the first row of the table
        const columnsCount = table.querySelector('tr').querySelectorAll('th, td').length;

        // 4. Move to the input exactly one row below (currentIndex + total columns)
        const nextInput = allInputs[currentIndex + 1]; 

        /* Note: To move DOWN like Excel, use: allInputs[currentIndex + columnsCount - 1]
           To move NEXT (sideways then down), use: allInputs[currentIndex + 1]
        */

        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        }
    }
}, true);