loadFramePacks([
	{name:'Generic Margins', value:'Margin-1'},
	{name: 'Fable (ECL) Margins', value:'MarginFableECL'},
	{name:'Elemental Margins (TLA)', value:'MarginElemental'},
	{name:'Edge of Eternities Basics (EOE)', value:'MarginEOEBasics'},
	{name:'Borderless Stellar Sights', value:'MarginBorderlessStellarSights'},
	{name:'Borderless Source Material', value:'MarginFCA'},
	{name:'Poster Stellar Sights', value:'MarginPosterStellarSights'},
	{name:'Draconic Margins', value:'MarginDraconic'},
	{name:'Japan Showcase Margins', value:'MarginJapanShowcase'},
	{name:'Showcase Magnified Margins', value:'MarginShowcaseMagnified'},
	{name:'Legends of Ixalan Margins', value:'MarginIxalanLegends'},
	{name:'Memory Corridor Margins', value:'MarginMemoryCorridor'},
	{name:'Breaking News Margin', value:'MarginBreakingNews'},
	{name:'Vault Margins', value:'MarginVault'},
	{name:'Wanted Poster Margins', value:'MarginWanted'},
	{name:'Enchanting Tales Margins', value:'MarginEnchantingTales'},
	{name:'LTR Ring Margins', value:'MarginRing'},
	{name:'D&D Module Margins', value:'MarginDNDModule'},
	{name:'Mystical Archive Margins', value:'MarginMysticalArchive'},
	{name:'Unfinity Basics Margins', value:'MarginUnfinity'},
	{name:'Unstable Basics Margins', value:'MarginUnstable'},
	{name:'Invocation Margins', value:'MarginInvocation'},
	{name:'Accurate Frame Margins', value:'MarginNew'},
	{name:'Custom Margins', value:'disabled'},
	{name:'Celid\'s Asap Margins', value:'CustomMarginCelidAsap'}
])

//For multiple Margin packs
var loadMarginVersion = async () => {
	await applyMarginFrameSizing({forceEnable:true});
}
