
function mlvdump(strInPath,strOutPath){
    //
    var mlvdumpPath = app.settings.getSetting("MLVimport","mlvdumpPath");
    var insFolIn = new Folder(strInPath);
    var lstFiles = insFolIn.getFiles();
    var expMLV = new RegExp("\.mlv$");
    for(var i in lstFiles){
        var f = lstFiles[i];
        if(!f instanceof File) continue;
        if(!f.name.toLowerCase().match(expMLV)) continue;
        
        //var strCmd = "cmd.exe /q /c" +
        var strBasename = f.name.replace(/\.[^\.]+$/, '');
        
        var insFolDNG = new Folder(strOutPath+"\\"+strBasename);
        if(!insFolDNG.exists) insFolDNG.create();
        var strCmd = "\"" + mlvdumpPath  + "\" " +
            " --dng -o " +
            strOutPath + "\\" + strBasename + "\\" +
            " \"" + strInPath+"\\"+f.name + "\"";
        //$.writeln(strCmd);
        var strRet = system.callSystem(strCmd);
        //$.writeln(strRet);
        /* // File::execute() is async
           var bat = new File(strOutPath + "\\" + f.name + ".bat");
           bat.open("w");
           bat.write (strCmd);
           bat.close();
           bat.execute()
        */
    }
}



function sequenceIDFromFilename(filename){
    filename = filename.replace(/[0-9]+\..{1,4}$/, '');
    
    if (filename === '') {
	return '###empty###';
    }
    
    return basename(filename.replace(/[^0-9A-Za-z]?$/, ''));
};

var glstCorrupted
var glstSeq = []
function FindDNGFolder(insFol){
    
    var lstFile = insFol.getFiles();

    var dicSequences = {};
    //find dng file
    for (var i in lstFile) {
	var f = lstFile[i];
        if (f instanceof File) {
            // workaround: bad workaround for files which are neither video, audio nor footage (e. g. txt-file),
            // todo: better check if given file is valid footage (what extensions?)
            if (f.name.toLowerCase().match(/\.dng/)) {
		var strBasename = f.name.replace(/\.[^\.]+$/, '');
                var sequenceID = sequenceIDFromFilename(f.name);
                var fileNumber = strBasename.match(/[0-9]+$/);

                // workaround: this is the workaround
                if (fileNumber !== null) {
                    if (dicSequences[sequenceID] === undefined) {
                        dicSequences[sequenceID] = {
                            file:           f,
                            numbers:        []
                        };
                    }

                    dicSequences[sequenceID].numbers.push(parseInt(fileNumber[0], 10));
                }
            }
        }else if (lstFile[i] instanceof Folder) {
            FindDNGFolder(lstFile[i]);
        }
    }
    //sort
    for (var seqID in dicSequences) {
        if (dicSequences[seqID].numbers.length > 1) {
            dicSequences[seqID].numbers.sort(function(a, b) {
                return (a - b);
            });
            try {
                for (var i = 0, l = dicSequences[seqID].numbers.length; i < l; i++) {
                    if (i > 0) {
                        if (dicSequences[seqID].numbers[i] !== (dicSequences[seqID].numbers[i - 1] + 1)) {
                            throw new Error('Corrupt Sequence');
                        }
                    }
                }

                glstSeq.push(dicSequences[seqID].file);
            }
            catch (error) {
                if (error.message === 'Corrupt Sequence') {
                    var corruptSequence = {
                        sequenceID:             seqID,
                        file:                   dicSequences[seqID].file,
                        numbers:                dicSequences[seqID].numbers,
                        missingFrames:  []
                    };

                    // todo: find missing frames at start, can't find missing frames at end
                    for (var i = 0, l = corruptSequence.numbers.length; i < l; i++) {
                        if (i > 0) {
                            if (corruptSequence.numbers[i] !== (corruptSequence.numbers[i - 1] + 1)) {
                                for (var j = 1, delta = corruptSequence.numbers[i] - corruptSequence.numbers[i - 1]; j < delta; j++) {
                                    corruptSequence.missingFrames.push(corruptSequence.numbers[i - 1] + j);
                                }
                            }
                        }
                    }
		    glstCorrupted.push(corruptSequence);
                }
                else {
                    throw error;
                }
            }
            finally {
                //smartImport.addSequenceFootageNamesPatternItem(seqID);
            }
        }
    }
    return;
}

function ImportFootage(){
    //import
    var lstFtgID = [];
    for(var seq in glstSeq){
    	 importFile(glstSeq[seq], true);
    }

	
}

function importFile(file, isSequence) {
    if (!file || !(file instanceof File) || !file.exists) {
	throw new Error('Invalid file given for import!');
    }
    
    var importOptions = new ImportOptions();
    var item = null;
    
    importOptions.file = file;
    importOptions.sequence = !!isSequence;
    
    item = app.project.importFile(importOptions);
    if(!!item){
	//set footage property
	var intFR = app.settings.getSetting("MLVimport","footageFrameRate");
	if ((item instanceof FootageItem) &&
	    !item.isStill) {
	    item.mainSource.conformFrameRate = intFR;
	}
    }

    //add composition
    var strBasename = file.path.replace(/\.[^\.]+$/, '');
    strBasename = strBasename.replace(/^.*\//,'');
    var comp = app.project.items.addComp(strBasename, item.width, item.height, item.pixelAspect, item.frameDuration, item.frameRate);
    var footageLayer = comp.layers.add(item);

    return;
};

function CreateProxy(strOutDir){
    for(var i = 1; i <= app.project.items.length;i++){
	var item = app.project.item(i);
	if(item instanceof CompItem){	
		
	    var rqItem = app.project.renderQueue.items.add(item);
	    rqItem.applyTemplate("mlvdraft");
	    rqItem.outputModule(1).applyTemplate("H.264");
	    rqItem.outputModule(1).file = new File(strOutFolder+"\\"+item.name)
	}
	
    }
//    app.project.renderQueue.render();    
}

function MLVimportMain(obj){
    if(!app.settings.haveSetting("MLVimport","mlvdumpPath")){
        app.settings.saveSetting("MLVimport","mlvdumpPath","d:\\jpvideo\\mlv_dump.exe");
    }
    if(!app.settings.haveSetting("MLVimport","footageFrameRate")){
        app.settings.saveSetting("MLVimport","footageFrameRate",24);
    }

    strInDir = "F:\\DCIM\\100EOS5D";
    strOutDir = "D:\\jpvideo\\aaa";
    
    //mlvdump(strInFolder,strOutDir);
    //FindDNGFolder(new Folder(strOutDir));
    //ImportFootage();
    CreateProxy(strOutDir);
}   


MLVimportMain(this);
