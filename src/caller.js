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
        logger.debug(`获取到地址: ${privateKey.address}}`);
        if (rpc && privateKey && privateKey.privateKey) {
          let p = new Worker(index, rpc, privateKey.privateKey); // 请根据实际情况替换worker的实例化方式
          let initResult = await p.init(); // 假设需要初始化worker
          if (!initResult) {
            throw new Error("任务初始化失败");
          }
          let success = await p.work(); // 执行具体任务
          if (!success) {
            process.send({
              type: "result",
              address: privateKey,
              status: false,
            });
            // logger.debug(`质押失败: ${privateKey.address} `);
          } else {
            process.send({
              type: "result",
              address: privateKey,
              status: true,
            });

            // logger.debug(`质押成功: ${privateKey.address} `);
          }
        }
        //延迟 100 ms
        await new Promise((resolve) => setTimeout(resolve, 100));
        process.send({ type: "requestItem" });
      } catch (error) {
        console.error(`第${index} 子进程出现错误:`, error);
        process.exit(1); // 在任何错误发生时退出进程
      }
    } else {
      counts--;
      if (counts === 0) {
        logger.success(`第${index} 子进程任务执行完毕`);
        process.exit(0);
      }
      //延迟1000ms
      await new Promise((resolve) => setTimeout(resolve, 100));
      process.send({ type: "requestItem" });
      // 如果任务余量为0，结束进程
    }
  });

  process.send({ type: "requestItem" });
}
main().catch((err) => {
  console.error(err);
});
