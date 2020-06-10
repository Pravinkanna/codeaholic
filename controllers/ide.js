const path = require("path");
const util = require("util");
const rp = require("request-promise");
const exec = util.promisify(require("child_process").exec);
const writeFile = util.promisify(require("fs").writeFile);
const mkdir = util.promisify(require("fs").mkdir);
const rmdir = util.promisify(require("fs").rmdir);

// Models
const Problem = require("../models/Problem");
//Token-ID
var token;

exports.run = async (req, res) => {
  const stdin = encodeB64(req.body.input);
  const src = encodeB64(req.body.code);
  const langId = req.body.lang;

  try {
    //Creating submission
    const token = await creteSingleSubmission(stdin, src, langId);
    //Getting submission with Token-ID
    var result = await getSingleSubmission(token);

    while (result["status"]["id"] <= 2) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      result = await getSingleSubmission(token);
    }
    if (result["stdout"]) result["stdout"] = decodeB64(result["stdout"]);
    if (result["stderr"]) result["stderr"] = decodeB64(result["stderr"]);
    if (result["error"]) result["error"] = decodeB64(result["error"]);
    if (result["message"]) result["message"] = decodeB64(result["message"]);
    if (result["compile_output"]) result["compile_output"] = decodeB64(result["compile_output"]);
    console.log(result);
    //Sending Response to user
    res.send(result);
  } catch (e) {
    console.log(e);
    res.send(JSON.stringify({ output: "", error: "SERVER ERROR" }));
  }
};

exports.submit = async (req, res) => {
  const srcCode = req.body.code;
  const lang = req.body.lang;
  const reg_no = req.user.reg_no;
  const urlParts = req.body.url.split("/");
  const problem_id = urlParts.pop() || urlParts.pop();
  //session id
  const sess_id = req.session.id;
  //Path to user directory
  pathToUserDir = path.join(__dirname, `../userCode/`);
  //Result array
  result = [];

  try {
    //Create directory
    await mkdir(pathToUserDir, { recursive: true });
    //Writing Src file
    await writeFile(`${pathToUserDir}${sess_id}_${lang}.${lang}`, srcCode, "utf8");
    //Getting Problem from DB
    const problem = await Problem.findById(problem_id);
    //Writing Hidden inputs to files & outputs to array
    for (const testcase of problem["hidden_testcases"]) {
      //Writing input file
      await writeFile(`${pathToUserDir}${sess_id}_input.txt`, testcase["input"], "utf8");
      const output = await run(sess_id, lang);
      console.log("user: ", output[0], "original: ", testcase["output"]);
      result.push(testcase["output"] == output[0].trimEnd());
    }
    //Deleting user directory
    await rmdir(pathToUserDir, { recursive: true });
    console.log(result);
  } catch (e) {
    console.log(e);
  }

  return res.send(JSON.stringify({ output: result, error: "" }));
};

//Function to Create Single Submission
const creteSingleSubmission = async (stdin, src, langId) => {
  return new Promise(async (resolve, reject) => {
    try {
      //CREATING A SUBMISSION
      var options = {
        method: "POST",
        url: "https://codeaholic-api.pravinkanna.me/submissions?base64_encoded=true",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          useQueryString: true,
        },
        body: {
          language_id: langId,
          source_code: src,
          stdin: stdin,
          expected_output: "Hello world",
        },
        json: true,
      };

      await rp(options, function (error, response, body) {
        if (error) throw new Error(error);
        token = body.token;
        console.log(token);
      });

      resolve(token);
    } catch (e) {
      console.error(e);
      error = e.toString();
      reject(error);
    }
  });
};

//Function to Get Single Submission
const getSingleSubmission = async (token) => {
  return new Promise(async (resolve, reject) => {
    var result = "";
    try {
      //GETTING A SUBMISSION
      var options = {
        method: "GET",
        url: "https://codeaholic-api.pravinkanna.me/submissions/" + token + "?base64_encoded=true",
        headers: {
          useQueryString: true,
        },
      };

      await rp(options, function (error, response, body) {
        if (error) throw new Error(error);
        result = JSON.parse(body);
        // console.log("ID: ", body);
        // console.log("ID: ", result.status.id);
      });

      resolve(result);
    } catch (e) {
      console.error(e);
      error = e.toString();
      reject(error);
    }
  });
};

const encodeB64 = (plainStr) => {
  const encodedStr = Buffer.from(plainStr).toString("base64");
  return encodedStr;
};

const decodeB64 = (encodedStr) => {
  const decodedStr = Buffer.from(encodedStr, "base64").toString("utf8");
  return decodedStr;
};

// if (lang === 'c') {
//     child = await exec(`gcc ${reg_no}_c.c -o ${reg_no}_c`, { cwd: pathToUserDir })
//     const { stdout, stderr } = await exec(`./${reg_no}_c < ${reg_no}_input.txt`, { timeout: 100, maxBuffer: 1024 * 100, cwd: pathToUserDir })
//     output = stdout;
//     error = stderr;
// } else if (lang === 'cpp') {
//     await exec(`g++ ${reg_no}_cpp.cpp -o ${reg_no}_cpp`, { cwd: pathToUserDir })
//     const { stdout, stderr } = await exec(`./${reg_no}_cpp < ${reg_no}_input.txt`, { timeout: 100, maxBuffer: 1024 * 100, cwd: pathToUserDir })
//     output = stdout;
//     error = stderr;
// } else if (lang === 'py') {
//     const { stdout, stderr } = await exec(`python3 ${reg_no}_py.py < ${reg_no}_input.txt`, { cwd: pathToUserDir });
//     output = stdout;
//     error = stderr;
// } else if (lang === 'java') {
//     await exec(`javac ${reg_no}_java.java`, { cwd: pathToUserDir });
//     const { stdout, stderr } = await exec(`java Main`, { cwd: pathToUserDir });
//     output = stdout;
//     error = stderr;
// } else {
//     console.error("No Language Selected");
//     error = "No Language Selected";
// }
