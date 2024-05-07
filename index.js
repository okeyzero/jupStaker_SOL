const Logger = require("@youpaichris/logger");
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const anchor = require("@coral-xyz/anchor");
const logger = new Logger();
const dotenv = require("dotenv");
dotenv.config();

const RPC_LIST = process.env.RPC_LIST.split(",") || [
  "https://solana-mainnet.g.alchemy.com/v2/K_HI4WpHLjhNYJBbxrrrKmNo3TEKGBCt", // todo
];

let keysPath = "keys.txt";
let sucessAddressPath = "sucessAddress.txt";
let failAddressPath = "failAddress.txt";
let callerPath = path.join(__dirname, "src", "caller.js");
let keysPrivateKeys = [];
let sucessAddress = [];
let failAddress = [];
if (process.pkg) {
  // 如果通过 pkg 打包，则使用这种方式获取路径 (If packaged through pkg, use this method to get the path)
  const exePath = path.dirname(process.execPath);
  keysPath = path.join(exePath, keysPath);
  sucessAddressPath = path.join(exePath, sucessAddressPath);
  failAddressPath = path.join(exePath, failAddressPath);
}

async function handleMintTask() {
  // const workerNum = Math.min(keysPrivateKeys.length, os.cpus().length);
  const workerNum = 1; // use for 1 stream
  let activeWorkerCount = workerNum;
  for (let i = 0; i < workerNum; i++) {
    logger.info(`Start ${i} child process...`);

    const child = cp.fork(callerPath, [i + 1]);

    child.on("error", (msg) => {
      logger.error(msg);
    });

    child.on("exit", (code) => {
      logger.info(`子进程退出，退出码 ${code}`);
      activeWorkerCount--;

      if (activeWorkerCount === 0) {
        //运行完 将 (After running will) sellerPrivateKeys 和 (and) getWallet(sellerPrivateKeys)导出到 (Export to) sellerNew.txt
        fs.writeFileSync(
          sucessAddressPath,
          sucessAddress
            .map((item) => `${item.address}----${item.privateKey}`)
            .join("\n")
        );
        fs.writeFileSync(
          failAddressPath,
          failAddress
            .map((item) => `${item.address}----${item.privateKey}`)
            .join("\n")
        );
        logger.info(`任务执行完毕 (The task is completed)`);
        // process.exit(0);
      }
    });

    child.on("message", (message) => {
      switch (message.type) {
        case "requestItem":
          // 处理子进程请求新任务的逻辑 (Logic for processing child process requests for new tasks)
          // console.log("子进程请求新任务 (The child process requests a new task)");
          let rpc = randomRpc();
          let taskNum = keysPrivateKeys.length;
          let privateKey = keysPrivateKeys.shift();

          if (privateKey) {
            const randomTimeout = Math.floor(Math.random() * 20000) + 10000; // random 10-30s todo
            setTimeout(() => {
              logger.info(`NEW WALLET`);
              child.send({
                rpc,
                privateKey,
                taskNum,
              });
              logger.info(`Delay: ${randomTimeout/1000} seconds`);
            }, randomTimeout);
          } else {
            child.kill();
          }
          // 假设这里有逻辑来检查是否还有剩余任务，然后发送任务信息给子进程 (Suppose there is logic here to check if there are any remaining tasks, and then send task information to the child process)
          break;
        case "result":
          // 处理子进程发送的操作结果 (Process the result of the operation sent by the child process)
          let status = message.status;
          if (status === true) {
            sucessAddress.push(message.address);
          } else {
            {
              failAddress.push(message.address);
            }
          }

          // 这里可以根据操作结果执行相应的逻辑，如更新数据库等 (Here you can perform corresponding logic based on the operation results, such as updating the database, etc.)
          break;
        default:
          console.log("未知消息类型 (Unknown message type)");
      }
    });
  }
}

async function getPrivateKeyAndAddress(key) {
  const args = key.split("----");
  const privateKey = args.length >= 2 ? args[1] : args[0];
  let address = args.length >= 2 ? args[0] : null;

  if (!address) {
    try {
      const wallet = await getWallet(privateKey);
      address = wallet.address;
    } catch (error) {
      if (args.length > 0 && args[0] !== "") {
        logger.error(`该数据 (The data): ${args}导入私钥失败 错误原因 (The reason for the error that failed to import the private key): ${error.message}`);
      }
      return { privateKey: null, address: null };
    }
  }

  return { privateKey, address };
}

function randomRpc() {
  return RPC_LIST[Math.floor(Math.random() * RPC_LIST.length)];
}

async function getWallet(privateKey) {
  const MyKeyPair = anchor.web3.Keypair.fromSecretKey(
    anchor.utils.bytes.bs58.decode(privateKey)
  );
  const wallet = new anchor.Wallet(MyKeyPair);
  return wallet;
}

async function filterValidPrivateKeys(buyers) {
  const results = await Promise.all(
    buyers.map(async (key) => {
      const result = await getPrivateKeyAndAddress(key);
      return result.privateKey !== null && result.address !== null
        ? result
        : undefined;
    })
  );
  const validPrivateKeys = results.filter((key) => key !== undefined);
  return validPrivateKeys;
}

async function main() {
  logger.warn(`当前版本为 (The current version is): 1.0.0`);
  //读取  keys 文件 (Read the keys file)
  const keys = fs
    .readFileSync(keysPath, "utf8")
    .split(/\r?\n/)
    .filter((key) => key);

  keysPrivateKeys = await filterValidPrivateKeys(keys);

  //打乱 (Disrupt) keysPrivateKeys 的顺序 (The order of)
  keysPrivateKeys.sort(() => Math.random() - 0.5);

  logger.info(`钱包数量 (Number of wallets): ${keysPrivateKeys.length}`);

  await handleMintTask();
}

main().catch((err) => {
  console.error(err);
});
