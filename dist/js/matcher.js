import {buildIndex,search} from './search.js';
export function match(commands,query){return search(buildIndex(commands),query).commands.map(r=>r.item);}
