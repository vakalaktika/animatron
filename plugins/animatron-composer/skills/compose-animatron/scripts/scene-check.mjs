#!/usr/bin/env node
import {ensureRepo,parseArgs,runHarness} from './lib.mjs';
try{
 const opts=parseArgs(process.argv.slice(2));
 if(opts.files.length<1||opts.files.length>2)throw new Error('usage: scene-check.mjs scene.json [plan.json] --repo checkout --offline');
 const repo=ensureRepo(opts),result=runHarness(repo,opts.files,{script:'sceneharness.ts',capture:true});
 const line=result.stdout.trim().split('\n').reverse().find(l=>l.startsWith('RESULT '));
 if(!line)throw new Error('scene preflight returned no result');
 const parsed=JSON.parse(line.slice(7));
 console.log(JSON.stringify(parsed,null,2));process.exitCode=parsed.ok&&result.status===0?0:1;
}catch(e){console.error(`scene-check: ${e.message}`);process.exitCode=1;}
