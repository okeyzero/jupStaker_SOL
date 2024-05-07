// import worker from "../src/worker.js";
const Logger = require("@youpaichris/logger");
const Worker = require("../src/worker.js");

const logger = new Logger();
const index = process.argv[2];

async function main() {
  let counts = 60;
  process.on("message", async (message) => {
    // console.log("message", message);
    if (message.taskNum > 0) {
      counts = 60;
      try {
        let rpc = message.rpc;
        let privateKey = message.privateKey;
        logger.debug(`获取到地址 (Get the address): ${privateKey.address}}`);
        if (rpc && privateKey && privateKey.privateKey) {
          let p = new Worker(index, rpc, privateKey.privateKey); // 请根据实际情况替换 (Please replace according to the actual situation)worker的实例化方式 (Instantiation method)
          let initResult = await p.init(); // 假设需要初始化 (Suppose initialization is required)worker
          if (!initResult) {
            throw new Error("任务初始化失败 (Task initialization failed)");
          }
          let success = await p.work(); // 执行具体任务 (Perform specific tasks)
          if (!success) {
            process.send({
              type: "result",
              address: privateKey,
              status: false,
            });
            // logger.debug(`质押失败 (Stake failed): ${privateKey.address} `);
          } else {
            process.send({
              type: "result",
              address: privateKey,
              status: true,
            });

            // logger.debug(`质押成功 (Successful stake): ${privateKey.address} `);
          }
        }
        //延迟 100 ms
        await new Promise((resolve) => setTimeout(resolve, 100));
        process.send({ type: "requestItem" });
      } catch (error) {
        console.error(`第${index} 子进程出现错误 (An error occurred in the child process):`, error);
        process.exit(1); // 在任何错误发生时退出进程 (Exit the process when any error occurs)
      }
    } else {
      counts--;
      if (counts === 0) {
        logger.success(`第${index} 子进程任务执行完毕 (The child process task is completed)`);
        process.exit(0);
      }
      //延迟1000ms (delay)
      await new Promise((resolve) => setTimeout(resolve, 100));
      process.send({ type: "requestItem" });
      // 如果任务余量为0，结束进程 (If the task margin is 0, end the process)
    }
  });

  process.send({ type: "requestItem" });
}
main().catch((err) => {
  console.error(err);
});
