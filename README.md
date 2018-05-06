# mlvimport
windows afterfx importer for MLV files

I'm using CS 5.5 on windows
Once launch the afterfx script, 
1:mlv_dump to dng
2:import dng footage to AE
3:create composition
4:added render queue for proxy

Does anyone tell me , if you know more comfortable work flow. 

Current limitation:
-GUI is not yet finished to implement.
-Can't use multi-byte char for folder name
-Script has no progress bar sign , so we need to check output folder for current mlv_dump progress.

Preparation:
-AE General settings->general->check "Permit to file and network access by AE script"
-edit strInDir,strOutDir,mlvdraft and H.264 parametars for your environment
-put script file to AE script dir
