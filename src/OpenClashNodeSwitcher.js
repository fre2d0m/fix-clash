// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: magic;
const controllerUrl = 'http://192.168.5.1:9090'; // Your OpenClash controller URL
const secret = '123456'; // Your OpenClash controller secret (if required)
const proxyGroupName = '♻️ 手动切换'; // The name of your proxy group
const testUrl = 'http://www.gstatic.com/generate_204'; // URL used for testing
const timeout = 1000; // Timeout for delay testing (in milliseconds)
// Your preferred nodes
const preferredNodes = [
  '🇸🇬 新加坡 01丨1x SG',
  '🇸🇬 新加坡 02丨1x SG',
  '🇸🇬 新加坡 03丨1x SG',
  '🇯🇵 日本 01丨1x JP',
  '🇯🇵 日本 02丨1x JP',
  '🇯🇵 日本 03丨1x JP',
];

async function makeRequest(url, method = 'GET', headers = {}, body = null) {
  const req = new Request(url);
  req.method = method;
  req.headers = headers;

  if (body) {
    req.body = JSON.stringify(body);
  }

  try {
    const json = await req.loadJSON();
    return json;
  } catch (error) {
    console.error(`Error making request to ${url}:`, error);
    console.log(
      `Response was: ${
        req.response === null
          ? null
          : JSON.stringify(req.response.headers) +
            ' \nBody:\n ' +
            (await req.response.text())
      }`
    );
    return null;
  }
}

async function getCurrentNode() {
  const url = `${controllerUrl}/proxies`;
  const headers = {
    Authorization: `Bearer ${secret}`,
  };
  try {
    const response = await makeRequest(url, 'GET', headers);
    return response.proxies[proxyGroupName]?.now;
  } catch (error) {
    console.error('Error getting current node:', error);
    return null;
  }
}

async function testNodeDelay(nodeName) {
  const url = `${controllerUrl}/proxies/${encodeURIComponent(
    nodeName
  )}/delay?timeout=${timeout}&url=${encodeURIComponent(testUrl)}`;
  const headers = {
    Authorization: `Bearer ${secret}`,
  };
  try {
    const response = await makeRequest(url, 'GET', headers);
    return response.delay;
  } catch (error) {
    console.error(`Error testing delay for ${nodeName}:`, error);
    return null;
  }
}

async function switchNode(nodeName) {
  const url = `${controllerUrl}/proxies/${encodeURIComponent(proxyGroupName)}`;
  const headers = {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };
  const payload = {
    name: nodeName,
  };
  try {
    const response = await makeRequest(url, 'PUT', headers, payload);
    console.log(`Successfully switched node to ${nodeName}:`, response);
    return true;
  } catch (error) {
    console.error(`Error switching node to ${nodeName}:`, error);
    return false;
  }
}

async function findBestNode(nodeList) {
  let bestNode = null;
  let lowestDelay = Infinity;

  for (const nodeName of nodeList) {
    const delay = await testNodeDelay(nodeName);
    if (delay !== null && delay < lowestDelay) {
      lowestDelay = delay;
      bestNode = nodeName;
    }
  }

  return bestNode;
}

async function sendNotification(title, body) {
  const notification = new Notification();
  notification.title = title;
  notification.body = body;
  notification.sound = 'default';
  await notification.schedule();
}

async function run() {
  const currentNode = await getCurrentNode();
  if (!currentNode) {
    await sendNotification('Switcher', '无法获取当前节点');
    return;
  }

  console.log('Current node:', currentNode);

  const currentDelay = await testNodeDelay(currentNode);
  if (currentDelay === null) {
    // Current node test failed, find the best node from the preferred list
    console.warn(
      'Current node test failed. Finding the best node from the preferred list...'
    );
    const bestNode = await findBestNode(preferredNodes);
    if (bestNode) {
      await switchNode(bestNode);
      const delay = await testNodeDelay(bestNode);
      await sendNotification(
        'Switcher',
        `已切换为节点"${bestNode}"，延迟 ${delay}ms`
      );
    } else {
      await sendNotification(
        'Switcher',
        '找不到可用的节点'
      );
    }
  } else {
    await sendNotification(
      'Switcher',
      `当前节点"${currentNode}"正常，延迟 ${currentDelay}ms`
    );
  }
}

await run();
