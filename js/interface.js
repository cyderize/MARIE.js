"use strict";

var assembleButton = document.getElementById("assemble"),
    stepButton = document.getElementById("step"),
    microStepButton = document.getElementById("microstep"),
    runButton = document.getElementById("run"),
    rangeDelay = document.getElementById("range-delay"),
    displayDelayMs = document.getElementById("display-delay-ms"),
    restartButton = document.getElementById("restart"),
    textArea = document.getElementById("program"),
    memoryContainer = document.getElementById("memory-container"),
    memoryHeaders = document.getElementById("memory-headers"),
    memory = document.getElementById("memory"),
    assembledCodeContainer = document.getElementById("assembled-code-container"),
    assembledCodeHeaders = document.getElementById("assembled-code-headers"),
    assembledCode = document.getElementById("assembled-code"),
    statusInfo = document.getElementById("status-info"),
    registerLabel = document.getElementById("register-label"),
    outputLog = document.getElementById("output-log"),
    outputLogOuter = document.getElementById("output-log-outer"),
    outputLogContainer = document.getElementById("tab-content1"),
    registerLog = document.getElementById("register-log"),
    registerLogOuter = document.getElementById("register-log-outer"),
    registerLogContainer = document.getElementById("tab-content2");

var asm = null,
    sim = null,
    interval = null,
    lastErrorLine = null,
    lastCurrentLine = null,
    lastBreakPointLine = null,
    breaking = false,
    delay = 1;
    
textArea.value = localStorage.getItem("marie-program") || "";
    
var programCodeMirror = CodeMirror.fromTextArea(textArea, {
    mode: "marie",
    lineNumbers: true,
    gutters: ["CodeMirror-linenumbers", "breakpoints"]
});

programCodeMirror.setSize(null, 400);

programCodeMirror.on("gutterClick", function(cm, n) {
    var info = cm.lineInfo(n);
    cm.setGutterMarker(n, "breakpoints", info.gutterMarkers ? null : makeMarker());
});

function makeMarker() {
    var marker = document.createElement("div");
    marker.style.color = "#07C";
    marker.innerHTML = "●";
    return marker;
}

function hex(num, isAddress) {
    isAddress = isAddress | 0;
    var s = "0000" + (num >>> 0).toString(16).toUpperCase();
    return s.substr(s.length - 4 + isAddress);
}

function populateMemoryView(sim) {
    while (memory.firstChild) {
        memory.removeChild(memory.firstChild);
    }
    
    while (memoryHeaders.firstChild) {
        memoryHeaders.removeChild(memoryHeaders.firstChild);
    }
    
    // Populate headers
    var i, j, th, tr, cell, header;
    var headers = document.createElement("tr");
    th = document.createElement("th");
    th.appendChild(document.createTextNode("+"));
    headers.appendChild(th);
    for (i = 0; i < 16; i++) {
        th = document.createElement("th");
        th.appendChild(document.createTextNode(hex(i, true)));
        headers.appendChild(th);
    }
    
    memoryHeaders.appendChild(headers);
        
    // Populate memory cells
    for (i = 0; i < 4096; i += 16) {
        tr = document.createElement("tr");
        
        header = document.createElement("th");
        header.appendChild(document.createTextNode(hex(i, true)));
        tr.appendChild(header);
                
        for (j = 0; j < 16; j++) {
            cell = document.createElement("td");
            cell.id = "cell" + (i + j);
            cell.className = "cell";
            cell.appendChild(document.createTextNode(hex(sim.memory[i + j].contents)));
            tr.appendChild(cell);
        }
        
        memory.appendChild(tr);
    }
    
    memoryContainer.style.display = "inline-block";
}

function populateAssembledCodeView(program) {
    while (assembledCode.firstChild) {
        assembledCode.removeChild(assembledCode.firstChild);
    }
    
    // Populate instruction cells
    var i, addressCounter = 0, addressHeader, key, tr, cell;
    for (i = 0; i < program.length; i++) {
        tr = document.createElement("tr");
        addressHeader = document.createElement("th");
        addressHeader.appendChild(document.createTextNode(MarieAsm.prototype.addressNumberFormatter(addressCounter)));
        tr.appendChild(addressHeader);
        addressCounter ++;
        
        for(key in program[i]) {
            if(key == "line") continue;
            cell = document.createElement("td");
            cell.className = "cell";
            if(key == "contents") {
                cell.appendChild(document.createTextNode(hex(program[i][key], false) || ""));
            } else {
                cell.appendChild(document.createTextNode(program[i][key] || ""));
            }
            tr.appendChild(cell);
        }
        
        assembledCode.appendChild(tr);
    }
}

function resetRegisters() {
    document.getElementById("ac").textContent = hex(sim.ac);
    document.getElementById("ir").textContent = hex(sim.ir);
    document.getElementById("mar").textContent = hex(sim.mar, true);
    document.getElementById("mbr").textContent = hex(sim.mbr);
    document.getElementById("pc").textContent = hex(sim.pc, true);
    document.getElementById("in").textContent = hex(sim.in);
    document.getElementById("out").textContent = hex(sim.out);
}

function initializeRegisterLog() {
    while (registerLog.firstChild) {
        registerLog.removeChild(registerLog.firstChild);
    }
}

function updateCurrentLine(clear) {
    if (lastCurrentLine != null) {
        programCodeMirror.removeLineClass(lastCurrentLine, "background", "current-line");
    }

    if (lastBreakPointLine != null) {
        programCodeMirror.removeLineClass(lastBreakPointLine, "background", "active-break-point");
    }
    
    if(clear) {
        return;
    }
    
    var line = sim.current().line;
    if (line != null) {
        programCodeMirror.addLineClass(line, "background", "current-line");
        lastCurrentLine = line;
        var info = programCodeMirror.lineInfo(line)
        if (info.gutterMarkers) {
            statusInfo.textContent = "Machine paused at break point.";
            programCodeMirror.addLineClass(line, "background", "active-break-point");
            lastBreakPointLine = line;
            breaking = true;
        }
    }
}

function initializeOutputLog() {
    while (outputLog.firstChild) {
        outputLog.removeChild(outputLog.firstChild);
    }
}

function outputFunc(value) {
    var shouldScrollToBottomOutputLog = outputLogOuter.clientHeight === (outputLogOuter.scrollHeight - outputLogOuter.scrollTop);
    
    outputLog.appendChild(document.createTextNode((value >>> 0).toString(16)));
    outputLog.appendChild(document.createElement("br"));
    
    if(shouldScrollToBottomOutputLog) {
        outputLogOuter.scrollTop = outputLogOuter.scrollHeight;
    }
}

function runLoop() {
    sim.step();
    updateCurrentLine();
    if (sim.halted) {
        window.clearInterval(interval);
        interval = null;
        runButton.textContent = "Halted";
        runButton.disabled = true;
        statusInfo.textContent = "Machine halted normally.";
        
    }
    else if (breaking) {
        window.clearInterval(interval);
        interval = null;
        runButton.textContent = "Continue";
    }
}

assembleButton.addEventListener("click", function() {
    window.clearInterval(interval);
    interval = null;
    
    if (lastErrorLine != null) {
        programCodeMirror.removeLineClass(lastErrorLine, "background", "error-line");
    }
    
    var breakPoints = document.getElementsByClassName("break-point");
    while (breakPoints.length > 0) {
        breakPoints[0].classList.remove("break-point");
    }
    
    var assembler = new MarieAsm(programCodeMirror.getValue());
    
    try {
        asm = assembler.assemble();
    } catch(e) {
        statusInfo.textContent = e.toString();
        statusInfo.className = "error";
        lastErrorLine = e.lineNumber - 1;
        programCodeMirror.addLineClass(lastErrorLine, "background", "error-line");
        console.error(e);
        return;
    }
    
    try {
        sim = new MarieSim(asm, null, outputFunc);
    } catch(e) {
        statusInfo.textContent = e.message;
        statusInfo.className = "error";
        console.error(e);
        return;
    }
    
    statusInfo.textContent = "Assembled successfully";
    statusInfo.className = ""; 
    
    sim.setEventListener("regwrite", function(e) {
        document.getElementById(e.register).textContent = hex(e.newValue, e.register == "mar" || e.register == "pc");
        
        if (e.register == "pc") {
            document.getElementById("cell" + e.oldValue).classList.remove("current-pc");
            document.getElementById("cell" + e.newValue).classList.add("current-pc");
        }
        
        if (e.register == "mar") {
            document.getElementById("cell" + e.oldValue).classList.remove("current-mar");
            document.getElementById("cell" + e.newValue).classList.add("current-mar");
        }
    })
    
    populateMemoryView(sim);
    console.log(asm.program);
    populateAssembledCodeView(asm.program);
    initializeOutputLog();
    initializeRegisterLog();
    resetRegisters();
    
    sim.setEventListener("memwrite", function(e) {
        var cell = document.getElementById("cell" + e.address);
        cell.textContent = hex(e.newCell.contents, false);
        cell.style.color = 'red';
    });
    
    sim.setEventListener("reglog", function(message) {
        var shouldScrollToBottomRegisterLog = registerLogOuter.clientHeight === (registerLogOuter.scrollHeight - registerLogOuter.scrollTop);
        
        registerLog.appendChild(document.createTextNode(message));
        registerLog.appendChild(document.createElement("br"));
        
        if(shouldScrollToBottomRegisterLog) {
            registerLogOuter.scrollTop = registerLogOuter.scrollHeight;
        }
    });
    
    stepButton.disabled = false;
    microStepButton.disabled = false;
    runButton.disabled = false;
    runButton.textContent = "Run";
    restartButton.disabled = false;
    
    updateCurrentLine(true);
});

stepButton.addEventListener("click", function() {
    if (!sim.halted) {
        sim.step();
    }
    else {
        statusInfo.textContent = "Machine halted normally.";
        runButton.textContent = "Halted";
        runButton.disabled = true;
    }
    updateCurrentLine();
});

microStepButton.addEventListener("click", function() {
    if (!sim.halted) {
        sim.microStep();
    }
    else {
        statusInfo.textContent = "Machine halted normally.";
        runButton.textContent = "Halted";
        runButton.disabled = true;
    }
    updateCurrentLine();
});

runButton.addEventListener("click", function() {
    if (interval) {
        window.clearInterval(interval);
        interval = null;
        runButton.textContent = "Run";
        statusInfo.textContent = "Halted at user request.";
    }
    else {
        runButton.textContent = "Stop";
        statusInfo.textContent = "Running...";
        breaking = false;
        
        interval = window.setInterval(runLoop, delay);
    }
});

rangeDelay.addEventListener("input", function() {
    displayDelayMs.textContent = this.value + " ms";
});

rangeDelay.addEventListener("change", function() {
    delay = parseInt(this.value);
    
    if(interval) {
        window.clearInterval(interval);
        interval = window.setInterval(runLoop, delay);
    }
});

restartButton.addEventListener("click", function() {
    window.clearInterval(interval);
    interval = null;
    sim.restart();
    resetRegisters();
    updateCurrentLine(true);
    runButton.textContent = "Run";
    runButton.disabled = false;
    statusInfo.textContent = "Restarted simulator (memory contents are still preserved)";
});

window.addEventListener("beforeunload", function() {
    window.localStorage.setItem("marie-program", programCodeMirror.getValue());
    return;
});
