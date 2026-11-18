import assert from "node:assert/strict";
import test from "node:test";
import type { HlsConfig, LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js";
import type { components } from "../src/shared/api/schema";
import { NextEpisodeBuffer, reuseOpening, shouldWarm } from "../src/_pages/series-details/ui/next-episode";

const network = { effectiveType: "4g", downlink: 8, rtt: 80 };
const ranges = (a: number,b: number) => ({ length: 1, start: () => a, end: () => b });
const video = { paused: false, ended: false, seeking: false, readyState: 3, duration: 60, currentTime: 39, played: ranges(31,39), buffered: ranges(37,50) };
const origin = "https://media.example";
const stream = (id: number) => ({ series_id: 7, episode_id: id, number: id, duration_sec: 60, subtitles: [], poster_url: "",
  url: origin + "/master.m3u8", expires_at: new Date(Date.now() + 60000).toISOString() } satisfies components["schemas"]["Playback"]);
const master = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=300000\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2500000\nhigh.m3u8\n";
const vod = "#EXTM3U\n#EXTINF:4.0,\n1.ts\n#EXTINF:5.0,\n2.ts\n#EXT-X-ENDLIST";

test("automatic warm-up needs visible playback, actual watching, buffered runway and confirmed fast connectivity", () => {
  assert.equal(shouldWarm(network,true,video),true);
  for (const candidate of [undefined, {}, { ...network, rtt: undefined }, { ...network, rtt: 0 }, { ...network, downlink: 2 }, { ...network, rtt: 240 },
    {...network,saveData:true},{...network,effectiveType:"3g"}]) assert.equal(shouldWarm(candidate,true,video),false);
  assert.equal(shouldWarm(network,false,video),false);
  for (const state of [{paused:true},{seeking:true},{ended:true},{readyState:2},{currentTime:1},{played:ranges(38,39)},
    {buffered:ranges(0,38)}, {buffered:ranges(30,40)}]) assert.equal(shouldWarm(network,true,{...video,...state}),false);
});

test("one target uses the lightest variant, at most one short media fragment and no neighboring account or episode",async t => {
  const urls: string[] = [];
  const ranges: (string | null)[] = [];
  t.mock.method(globalThis,"fetch",async (input: string, init: RequestInit) => {
    urls.push(input); ranges.push(new Headers(init.headers).get("Range"));
    return input.endsWith("master.m3u8") ? new Response(master) : input.endsWith("low.m3u8") ? new Response(vod)
      : new Response(new Uint8Array([1,2,3]), {status:206,headers:{"Content-Range":"bytes 0-2/3"}});
  });
  let lookups = 0;
  const buffer = new NextEpisodeBuffer(async id => { lookups++; return stream(Number(id)); });
  await Promise.all([buffer.prepare(7,2),buffer.prepare(7,2)]);
  assert.equal(lookups,1);
  assert.deepEqual(urls,[origin + "/master.m3u8",origin + "/low.m3u8",origin + "/1.ts"]);
  assert.deepEqual(ranges,[null,null,"bytes=0-786431"]);
  const entry = buffer.take(7,2);
  assert.ok(entry);
  assert.equal(entry.resources.size,3);
  assert.equal(buffer.take(7,2),undefined);
  await buffer.prepare(7,2);
  assert.equal(buffer.take(9,2),undefined);

  // hls.js must receive the warmed bytes through its normal fragment callbacks and use the network for unknown URLs.
  let misses = 0;
  class Base {
    stats = {loading:{},aborted:false};
    load() { misses++; }
    abort() {}
  }
  const Loader = reuseOpening(Base as unknown as HlsConfig["loader"],entry);
  const loader = new Loader({} as HlsConfig);
  const ctx = {url:origin+"/1.ts",responseType:"arraybuffer"} as LoaderContext;
  let consumed: ArrayBuffer | undefined;
  let delivered = false;
  const callbacks = {onProgress:() => {delivered=true;},onSuccess:(result: {data:ArrayBuffer}) => {consumed=result.data;}} as unknown as LoaderCallbacks<LoaderContext>;
  loader.load(ctx,{} as LoaderConfiguration,callbacks);
  await Promise.resolve();
  assert.equal(delivered,true);
  assert.deepEqual(new Uint8Array(consumed!),new Uint8Array([1,2,3]));
  loader.load({...ctx,url:origin+"/2.ts"},{} as LoaderConfiguration,callbacks);
  assert.equal(misses,1);
});

test("denied, expired, cross-origin, single-segment and oversized candidates never feed speculative video bytes into playback",async t => {
  let playlist = "#EXTM3U\n#EXTINF:4,\nwhole.ts\n#EXT-X-ENDLIST";
  let calls = 0;
  t.mock.method(globalThis,"fetch",async (url: string) => {
    calls++;
    return url.endsWith(".m3u8") ? new Response(playlist) :
      new Response(new Uint8Array(2),{status:206,headers:{"Content-Range":"bytes 0-1/1000000"}});
  });
  const denied = new NextEpisodeBuffer(async () => { throw Error("locked"); });
  await denied.prepare(7,2);
  assert.equal(calls,0);
  assert.equal(denied.take(7,2),undefined);
  let now = Date.now();
  const buffer = new NextEpisodeBuffer(async id => stream(Number(id)),() => now);
  await buffer.prepare(7,2);
  assert.equal(calls,1);
  assert.equal(buffer.take(7,2)?.resources.size,1);
  playlist = vod.replace("1.ts","https://other.example/1.ts");
  await buffer.prepare(7,2);
  assert.equal(calls,2);
  assert.equal(buffer.take(7,2)?.resources.size,1);
  playlist=vod;
  await buffer.prepare(7,2);
  assert.equal(calls,4);
  const warmed = buffer.take(7,2)!;
  assert.equal(warmed.resources.has(origin+"/1.ts"),false);
  await buffer.prepare(7,2);
  now+=60000;
  assert.equal(buffer.take(7,2),undefined);
});

test("canceling background work aborts its in-flight request and does not read the following segment",async t => {
  let requests=0;
  let opened!: () => void;
  const ready=new Promise<void>(resolve => {opened=resolve;});
  t.mock.method(globalThis,"fetch",async (_: string, {signal}: {signal:AbortSignal}) => {
    requests++; opened();
    return new Promise<Response>((_,reject) => signal.addEventListener("abort",() => reject(signal.reason),{once:true}));
  });
  const buffer=new NextEpisodeBuffer(async id => stream(Number(id)));
  const pending=buffer.prepare(7,2);
  await ready;
  buffer.clear();
  await pending;
  assert.equal(requests,1);
  assert.equal(buffer.take(7,2),undefined);
});
