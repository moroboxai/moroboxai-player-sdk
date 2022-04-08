import { expect } from 'chai';
import 'chai';
import * as http from 'http';
import * as net from 'net';
import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import * as MoroboxAIPlayerSDK from '../src/';

describe('MoroboxAIPlayerSDK', function ()
{
    it('should have VERSION', function ()
    {
        expect(MoroboxAIPlayerSDK.VERSION).to.be.equal('0.1.0-alpha.1');
    });
});