import { runVoicingSearch, VoicingSearchRequest } from '../utils/voicing-batch';

self.onmessage = (event: MessageEvent<VoicingSearchRequest>) => {
  runVoicingSearch(event.data, (message) => self.postMessage(message));
};
