function progress(intMax){
  $.writeln("pMAX:"+intMax);
  var win = new Window("palette","Extracting DNG...");
  if(intMax==undefined){
      intMax = 100;
  }
  win.progressbar = win.add("Progressbar",[10,10,300,20],0,intMax);  
  win.center();  
  win.show();
  
  win.progressbar.value = 0;  
  win.update();  
  
  function close(){
    win.close();  
  }
  function updatepct(intVal){
    win.progressbar.value = intVal;  
    win.update();
  }
  return {close:close,
          updatepct:updatepct}
}

function mlvdump(strInPath,strOutPath){
  //
  var mlvdumpPath = app.settings.getSetting("MLVimport","mlvdumpPath");
  var insMD = new File(mlvdumpPath);
  var insFolIn = new Folder(strInPath);
  var insFolOut = new Folder(strOutPath);

  if(!insMD.exists){
    alert("Invalid mlv_dump path: No such file");
    return -1;
  }   
  if(!insFolIn.exists){
    alert("Invalid Import folder: No such dir");
    return -1;
  }   
  if(!insFolOut.exists){
    alert("Invalid Output folder:No such dir("+strOutPath+")");
    return -1;
  }

  var lstFiles = insFolIn.getFiles();
  var expMLV = new RegExp("\.mlv$");
  //count mlv file
  var intFilenum=0;
  for(var i in lstFiles){
    var f = lstFiles[i];
    if(!f instanceof File) continue;
    if(!f.name.toLowerCase().match(expMLV)) continue;
    //var strCmd = "cmd.exe /q /c" +
    intFilenum++;
  }

  if(intFilenum==0){
    alert("No MLV file exists in specified in dir");
    return -1
  }
  // var p = progress(intFilenum);

  var intCount=1;
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
    // p.updatepct(intCount);
    // intCount++;
  }
  // p.close();
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
    var intFR = app.settings.getSetting("MLVimport","fps");
    if ((item instanceof FootageItem) &&
	!item.isStill) {
      item.mainSource.conformFrameRate = intFR;
    }
  }

  //add composition
  var strBasename = file.path.replace(/\.[^\.]+$/, '');
  strBasename = strBasename.replace(/^.*\//,'');
  $.writeln("dul:"+item.frameDuration);
  var comp = app.project.items.addComp(strBasename,
				       item.width,
				       item.height,
				       item.pixelAspect,
				       item.duration,
				       item.frameRate);
  var footageLayer = comp.layers.add(item);

  return;
};

function CreateProxy(strOutDir){
  var strRenderTemplate = app.settings.getSetting("MLVimport","RenderTemplate");
  var strOutputTemplate = app.settings.getSetting("MLVimport","OutputTemplate");
  for(var i = 1; i <= app.project.items.length;i++){
    var item = app.project.item(i);
    $.writeln("CompCount:"+item.length);
    if(item instanceof CompItem){	
      $.writeln(item.name);
      var rqItem = app.project.renderQueue.items.add(item);
      rqItem.applyTemplate(strRenderTemplate);
      rqItem.outputModule(1).applyTemplate(strOutputTemplate);
      rqItem.outputModule(1).file = new File(strOutDir+"\\"+item.name)
    }
    
  }
  $.writeln(app.project.items.length);
  //    app.project.renderQueue.render();    
}

function ShowDLG(){
  var strDumpPath = app.settings.getSetting("MLVimport","mlvdumpPath");
  var strInDir = app.settings.getSetting("MLVimport","indir");
  var strOutDir = app.settings.getSetting("MLVimport","outdir");
  var intFPS = app.settings.getSetting("MLVimport","fps");
  var strRenderTemplate = app.settings.getSetting("MLVimport","RenderTemplate");
  var strOutputTemplate = app.settings.getSetting("MLVimport","OutputTemplate");


  var dlg = new Window('window', 'MLVimport', undefined, {
    resizeable: false,
    closeButton: true,
    maximizeButton: false,
    minimizeButton: true,
    independant: false,
    borderless: false
  });
  dlg.orientation = 'column';
  dlg.alignChildren = 'fill';
  
  /* -- begin import section -- */
  dlg.grpTop = dlg.add('group');
  dlg.grpTop.orientation = 'column';
  dlg.grpTop.alignChildren = 'fill';

  //in out folder panel
  dlg.pnlDir = dlg.grpTop.add('panel', undefined, "Import Settings");
  dlg.pnlDir.orientation = 'column';
  dlg.pnlDir.alignChildren = 'fill';

  //in path
  dlg.grpInFolder = dlg.pnlDir.add('group');
  dlg.grpInFolder.orientation = 'row';
  dlg.grpInFolder.alignChildren = ['fill', 'center'];

  dlg.grpInFolder.add('statictext',[30, 13, 80, 33], '.mlv dir');
  
  dlg.etInFolder = dlg.grpInFolder.add('edittext', undefined,strInDir);
  dlg.btnInFolderIn = dlg.grpInFolder.add('button', undefined,"dir");
  dlg.btnInFolderIn.alignment = ['right', 'center'];

  //outpath
  dlg.grpOutFolder = dlg.pnlDir.add('group');
  dlg.grpOutFolder.orientation = 'row';
  dlg.grpOutFolder.alignChildren = ['fill', 'center'];

  dlg.grpOutFolder.add('statictext',[30, 34, 80, 54], 'Out dir');

  dlg.etOutFolder = dlg.grpOutFolder.add('edittext', undefined,strOutDir);
  dlg.btnOutFolderOut = dlg.grpOutFolder.add('button', undefined,"dir");
  dlg.btnOutFolderOut.alignment = ['right', 'center'];

  //FPS
  dlg.grpFPS = dlg.pnlDir.add('group');
  dlg.grpFPS.orientation = 'row';
  dlg.grpFPS.alignChildren = ['fill', 'center'];
  //dlg.etFPS = dlg.grpFPS.add('text','aaa');
  dlg.grpFPS.add('statictext',[30, 34, 80, 54], 'FPS:');
  dlg.etFPS = dlg.grpFPS.add('edittext',undefined,intFPS);

  //RenderTemplate
  dlg.grpRT = dlg.pnlDir.add('group');
  dlg.grpRT.orientation = 'row';
  dlg.grpRT.alignChildren = ['fill', 'center'];
  //dlg.etFPS = dlg.grpFPS.add('text','aaa');
  dlg.grpRT.add('statictext',[30, 34, 80, 54], 'RendrTempl:');
  dlg.etRT = dlg.grpRT.add('edittext',undefined,strRenderTemplate);

  //OutputTemplate
  dlg.grpOT = dlg.pnlDir.add('group');
  dlg.grpOT.orientation = 'row';
  dlg.grpOT.alignChildren = ['fill', 'center'];
  //dlg.etFPS = dlg.grpFPS.add('text','aaa');
  dlg.grpOT.add('statictext',[30, 34, 80, 54], 'OutTempl:');
  dlg.etOT = dlg.grpOT.add('edittext',undefined,strOutputTemplate);

  /* next panel (settings)*/
  //settings panel
  dlg.pnlSettings = dlg.grpTop.add('panel', undefined, "Settings");
  dlg.pnlSettings.orientation = 'column';
  dlg.pnlSettings.alignChildren = 'fill';

  //mlv_dump path
  dlg.grpDumpPath = dlg.pnlSettings.add('group');
  dlg.grpDumpPath.orientation = 'row';
  dlg.grpDumpPath.alignChildren = ['fill', 'center'];
  dlg.grpDumpPath.add('statictext',[30, 34, 80, 54], 'mlv_dump.exe:');
  dlg.etDumpPath = dlg.grpDumpPath.add('edittext',undefined,strDumpPath);
  dlg.btnDumpPath = dlg.grpDumpPath.add('button', undefined,"dir");

  var btnOk = dlg.add("button", [55, 100, 140, 135], "OK");
  var btnCancel = dlg.add("button", [155, 100, 240, 135], "Cancel");
  btnCancel.onClick = function(){
    dlg.close();
  }

  btnOk.onClick = function(){
    dlg.close();
    var strInDir = dlg.etInFolder.text;
    var strOutDir = dlg.etOutFolder.text;
    var strFPS = dlg.etFPS.text;
    var strDumpPath = dlg.etDumpPath.text;
    var strRenderTemplate = dlg.etRT.text;
    var strOutputTemplate = dlg.etOT.text;

    //validate
    var intFPS = parseInt(strFPS)
    if(intFPS < 1 || intFPS > 120){
      $.writeln("invalid FPS value(1-120)");
      alert("invalid FPS value(1-120)");
      return;
    }
    if(strInDir.length == 0){
      $.writeln("no InDir specified");
      alert("no InDir specified");
      return;
    }
    if(strOutDir.length == 0){
      $.writeln("no OutDir specified");
      alert("no OutDir specified");
      return;
    }
    if(strDumpPath.length == 0){
      $.writeln("no DumpPath specified");
      alert("no DumpPath specified");
      return;
    }
    
    app.settings.saveSetting("MLVimport","indir",strInDir);
    app.settings.saveSetting("MLVimport","outdir",strOutDir);
    app.settings.saveSetting("MLVimport","fps",intFPS);
    app.settings.saveSetting("MLVimport","mlvdumpPath",strDumpPath);
    app.settings.saveSetting("MLVimport","RenderTemplate",strRenderTemplate);
    app.settings.saveSetting("MLVimport","OutputTemplate",strOutputTemplate);

    $.writeln("Do mlvdump()");
    if(mlvdump(strInDir,strOutDir)== -1){
      return;
    }
    FindDNGFolder(new Folder(strOutDir));
    ImportFootage();
    CreateProxy(strOutDir);
  }
  
  dlg.show();
}

function InitDefaults(){
  if(!app.settings.haveSetting("MLVimport","mlvdumpPath")){
    app.settings.saveSetting("MLVimport","mlvdumpPath","d:\\jpvideo\\mlv_dump.exe");
  }
  if(!app.settings.haveSetting("MLVimport","fps")){
    app.settings.saveSetting("MLVimport","fps",24);
  }
  if(!app.settings.haveSetting("MLVimport","indir")){
    app.settings.saveSetting("MLVimport","indir","F:\\DCIM\\100EOS5D");
  }
  if(!app.settings.haveSetting("MLVimport","outdir")){
    app.settings.saveSetting("MLVimport","outdir","D:\\jpvideo\\aaa");
  }
  if(!app.settings.haveSetting("MLVimport","RenderTemplate")){
    app.settings.saveSetting("MLVimport","RenderTemplate","ドラフト設定");
  }
  if(!app.settings.haveSetting("MLVimport","OutputTemplate")){
    app.settings.saveSetting("MLVimport","OutputTemplate","H.264");
  }
  
}   


InitDefaults();
ShowDLG();
