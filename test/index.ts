import { expect } from 'chai';
import 'chai';
import * as MoroboxAIPlayerSDK from '../src/';

const packageJson = require('../package.json');

describe('MoroboxAIPlayerSDK', function ()
{
    it('should have VERSION', function ()
    {
        expect(MoroboxAIPlayerSDK.VERSION).to.be.equal(packageJson.version);
    });
});