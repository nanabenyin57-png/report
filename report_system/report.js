console.log("Report script is loaded and active!");
// The function to generat the table head
function table_head(){
    var tablehead= document.getElementById("department").value;
    const header= document.getElementById("headerrow");
    let col1= "<th>STUDENT NAME</th>";
    if(tablehead==="Preschool"){
        col1+= "<th>LITERACY</th><th>NUMERACY</th><th>CREATIVe ARTS</th><th>WRITING</th><th>TOTAL</th>";
    }
    else if(tablehead==="LowerPrimary"){
        col1+= "<th>ENGLISH</th><th>MATHS</th><th>SCIENCE</th><th>TWI</th><th>HISTORY</th><th>RELIGIOUS EDUCATION</th><th>CREATIVE ARTS</th><th>FRENCH</th><th>TOTAL</th";
    }
      else if(tablehead==="UpperPrimary"){
        col1+= "<th>ENGLISH</th><th>MATHS</th><th>SCIENCE</th><th>COMPUTING</th><th>TWI</th><th>HISTORY</th><th>RELIGIOUS EDUCATION</th><th>CREATIVe ARTS</th><th>FRENCH</th><th>TOTAL</th";
    }
    else if(tablehead==="JuniorHigh"){
        col1+= "<th>ENGLISH</th><th>MATHS</th><th>SCIENCE</th><th>COMPUTING</th><th>TWI</th><th>SOCIAL STUDIES</th><th>RELIGIOUS EDUCATION</th><th>CREATIVe ARTS</th><th>FRENCH</th><th>CAREER TECHNOLOGY<th>TOTAL</th";
    }
    else{
        col1="<th>Please Select A Department";
    }
    header.innerHTML= col1;
}
// Function to generate table rows based on user input
function genrows() {
    const count= document.getElementById("studentcount").value;
    const dept= document.getElementById("department").value;
    const tablebody= document.getElementById("tablebody");
    tablebody.innerHTML= "";
    for(var i=0; i<count; i++){
        let rowcontent=`<td> <input type="text" name="STUDENT_NAME[]" required> </td>`;
        if(dept==="Preschool"){
            rowcontent += `
            <td> <input type="number" Name="LITERACY[]" class="score" oninput="calculateRowTotal(this)" required> </td>
            <td> <input type="number" Name="NUMERACY[]" class="score" oninput="calculateRowTotal(this)" required> </td>
            <td> <input type="number" Name="CREATIVE_ARTS[]" class="score" oninput="calculateRowTotal(this)" required> </td>
            <td> <input type="number" Name="WRITING[]" class="score" oninput="calculateRowTotal(this)" required> </td> `; 
        }
        else if(dept==="LowerPrimary"){
             rowcontent += `
         <td> <input type="number" Name="ENGLISH[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="MATHS[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="SCIENCE[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="HISTORY[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="CREATIVE_ARTS[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="FRENCH[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="RELIGIOUS_EDUCATION[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="TWI[]" class="score" oninput="calculateRowTotal(this)" required> </td>
          `;
        }
else if(dept==="UpperPrimary"){
             rowcontent += `
         <td> <input type="number" Name="ENGLISH[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required> </td>
         <td> <input type="number" Name="MATHS[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required> </td>
         <td> <input type="number" Name="SCIENCE[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required> </td>
         <td> <input type="number" Name="COMPUTING[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required> </td>
         <td> <input type="number" Name="HISTORY[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required> </td>
         <td> <input type="number" Name="CREATIVE_ARTS[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required> </td>
         <td> <input type="number" Name="FRENCH[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required> </td>
         <td> <input type="number" Name="RELIGIOUS_EDUCATION[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required> </td>
         <td> <input type="number" Name="TWI[]" class="score" oninput="calculateRowTotal(this)" min="0" max="100" required> </td>  `;
        }
       else{
             rowcontent += `
         <td> <input type="number" Name="ENGLISH[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="MATHS[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="SCIENCE[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="COMPUTING[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="SOCIAL_STUDIES[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="CREATIVE_ARTS[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="FRENCH[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="RELIGIOUS_EDUCATION[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="TWI[]" class="score" oninput="calculateRowTotal(this)" required> </td>
         <td> <input type="number" Name="CAREER_TECHNOLOGY[]" class="score" oninput="calculateRowTotal(this)" required> </td>  `;
        }
        rowcontent +=`<td> <input type="number" Name="TOTAL_SCORE[]" class="total-box" readonly> </td> `
    tablebody.innerHTML += `<tr>${rowcontent}</tr>`;
    }
}
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
       function downloadCSV() {
    const rows = document.querySelectorAll("table tr");
    let csvContent = "";

    rows.forEach((row) => {
        const cols = row.querySelectorAll("td, th");
        let rowData = [];

        cols.forEach((col) => {
            // Check if there is an input inside this cell
            const input = col.querySelector("input");
            
            if (input) {
                // Get the value typed by the user
                rowData.push(input.value);
            } else {
                // Get the text (for the headers like NAME, MATH, etc.)
                rowData.push(col.innerText);
            }
        });

        csvContent += rowData.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_report.csv";
    a.click();
    
    // Clean up memory
    URL.revokeObjectURL(url);
}
   
 
 function toggleMenu(){
    const overlay = document.getElementById("navover");
    const humburger= document.getElementById("navigation");
    overlay.classList.toggle("open");
    humburger.classList.toggle("is-active");
 }
 table_head();
 genrows();
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