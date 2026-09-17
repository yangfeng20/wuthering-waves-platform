import { GameApiClient } from '../http/game.js';
import { CommunityApiClient } from '../http/community.js';
import { WikiApiClient } from '../http/wiki.js';
import { GachaApiClient } from '../http/gacha.js';
import { ExternalDataClient } from '../http/external.js';
import { HttpClient } from '../http/client.js';
import { CredentialStore } from '../storage/credentials.js';
import { AccountService } from './account.js';
import { BuildAnalyzer } from './analyzer.js';
import { BenchmarkService } from './benchmark.js';
import { CommunityService } from './community.js';
import { GameDataService } from './game.js';
import { GachaService } from './gacha.js';
import { SimulatorService } from './simulator.js';
import { WikiService } from './wiki.js';

/**
 * 创建通用业务服务容器。
 * @param {object} config 项目配置。
 * @returns {object} 服务容器。
 */
export function createServices(config) {
  const http = new HttpClient(config);
  const gameApi = new GameApiClient(http);
  const communityApi = new CommunityApiClient(http);
  const wikiApi = new WikiApiClient(http);
  const gachaApi = new GachaApiClient(http);
  const externalApi = new ExternalDataClient(http);
  const store = new CredentialStore(config);
  const analyzer = new BuildAnalyzer(config);
  const accounts = new AccountService({ store, gameApi });
  const game = new GameDataService({ accounts, gameApi, analyzer, config });
  const community = new CommunityService({ accounts, communityApi });
  const external = { game: gameApi, external: externalApi };
  const wiki = new WikiService({ wikiApi, externalApi: external });
  const gacha = new GachaService({ gachaApi });
  const simulator = new SimulatorService(wiki);
  const benchmark = new BenchmarkService({ game, analyzer });
  return {
    config,
    http,
    store,
    accounts,
    game,
    community,
    wiki,
    gacha,
    simulator,
    benchmark,
  };
}
