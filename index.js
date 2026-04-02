const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionResponseFlags
} = require('discord.js');

// 🔑 CONFIG
const TOKEN = process.env.DISCORD_TOKEN;

const STAFF_CHANNEL_ID = '1483618518808395911';
const PANEL_CHANNEL_ID = '1483618518808395913';
const RESULT_CHANNEL_ID = '1483618518808395914';

const STAFF_ROLE_ID = '1483618517621280810';
const PENDING_ROLE_ID = '1483618517621280809';

const BANNER_URL = 'https://i.ibb.co/x8SmhSg5/4m.webp';
const TIME_LIMIT = 30000; // 30 segundos

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const sessions = new Map();

// 📌 Perguntas
const questions = [
  'Qual seu nome (vida real)?',
  'Qual sua idade (vida real)?',
  'O que é RDM?',
  'O que é VDM?',
  'O que é MG (MetaGaming)?',
  'O que é PG (PowerGaming)?',
  'O que é Dark RP?',
  'O que é amor à vida?',
  'O que é Car Parking?',
  'O que é OCC?',
  'Cite 3 safe zones',
  'Você está disposto a bater a meta de 30 capuz / 15k de dinheiro sujo semanalmente?',
  'O que você irá ajudar na facção?',
  'Você concorda com as regras? (sim/não)'
];

// 📌 Ready
client.once('ready', async () => {
  console.log(`Bot online como ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle('📋 Formulário RP')
      .setDescription('Clique no botão abaixo para iniciar.')
      .setImage(BANNER_URL)
      .setColor('Blue');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_form')
        .setLabel('Iniciar Formulário')
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('Erro ao enviar painel de formulário:', err);
  }
});

// 📌 Fazer pergunta com tempo
async function askQuestion(channel, userId, step) {
  const session = sessions.get(userId);
  if (!session) return;

  const embed = new EmbedBuilder()
    .setDescription(`⏱️ Você tem 30 segundos!\n\n**${questions[step]}**`)
    .setColor('Blue');

  await channel.send({ embeds: [embed] });

  // timeout
  session.timeout = setTimeout(async () => {
    if (sessions.has(userId)) {
      await channel.send('⏰ Tempo esgotado! Formulário cancelado.');
      sessions.delete(userId);
      channel.delete().catch(() => {});
    }
  }, TIME_LIMIT);
}

// 📌 Interactions
client.on(Events.InteractionCreate, async interaction => {

  // ▶️ iniciar formulário
  if (interaction.isButton() && interaction.customId === 'start_form') {
    await interaction.deferReply({ flags: InteractionResponseFlags.Ephemeral });

    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);

    try {
      const channel = await guild.channels.create(`form-${member.user.username}`, {
        type: 0, // texto
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
        ],
        reason: 'Canal de formulário RP'
      });

      sessions.set(member.id, {
        step: 0,
        answers: {},
        channelId: channel.id,
        timeout: null
      });

      await interaction.followUp({
        content: `📌 ${channel}\n⚠️ Você tem **30 segundos por pergunta**.`,
        flags: InteractionResponseFlags.Ephemeral
      });

      await askQuestion(channel, member.id, 0);

    } catch (err) {
      console.error('Erro ao criar canal de formulário:', err);
      await interaction.followUp({
        content: '❌ Não foi possível criar o canal de formulário.',
        flags: InteractionResponseFlags.Ephemeral
      });
    }
  }

  // ▶️ aprovar
  if (interaction.isButton() && interaction.customId.startsWith('aprovar_')) {
    await interaction.deferReply({ flags: InteractionResponseFlags.Ephemeral });

    const userId = interaction.customId.split('_')[1];
    const member = await interaction.guild.members.fetch(userId);
    await member.roles.add(PENDING_ROLE_ID);

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setFooter({ text: `✅ ${interaction.user.tag} aprovou` });

    await interaction.message.edit({ embeds: [embed], components: [] });

    const resultChannel = await client.channels.fetch(RESULT_CHANNEL_ID);

    const resultEmbed = new EmbedBuilder()
      .setTitle('✅ Aprovado')
      .setDescription(`<@${userId}> foi aprovado!`)
      .setImage(BANNER_URL)
      .setColor('Green');

    await resultChannel.send({ embeds: [resultEmbed] });

    await interaction.editReply({ content: 'Aprovado!', flags: InteractionResponseFlags.Ephemeral });
  }

  // ▶️ abrir modal reprovar
  if (interaction.isButton() && interaction.customId.startsWith('reprovar_')) {
    const userId = interaction.customId.split('_')[1];

    const modal = new ModalBuilder()
      .setCustomId(`reprovar_${userId}`)
      .setTitle('Motivo da reprovação');

    const input = new TextInputBuilder()
      .setCustomId('motivo')
      .setLabel('Digite o motivo')
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }

  // ▶️ resposta do modal
  if (interaction.isModalSubmit() && interaction.customId.startsWith('reprovar_')) {
    await interaction.deferReply({ flags: InteractionResponseFlags.Ephemeral });

    const userId = interaction.customId.split('_')[1];
    const motivo = interaction.fields.getTextInputValue('motivo');

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setFooter({ text: `❌ ${interaction.user.tag} reprovou | ${motivo}` });

    await interaction.message.edit({ embeds: [embed], components: [] });

    const resultChannel = await client.channels.fetch(RESULT_CHANNEL_ID);

    const resultEmbed = new EmbedBuilder()
      .setTitle('❌ Reprovado')
      .setDescription(`<@${userId}> foi reprovado\n\nMotivo: ${motivo}`)
      .setImage(BANNER_URL)
      .setColor('Red');

    await resultChannel.send({ embeds: [resultEmbed] });

    await interaction.editReply({ content: 'Reprovado!', flags: InteractionResponseFlags.Ephemeral });
  }
});

// 📌 Respostas
client.on(Events.MessageCreate, async message => {

  if (message.author.bot) return;

  const session = sessions.get(message.author.id);
  if (!session) return;
  if (message.channel.id !== session.channelId) return;

  clearTimeout(session.timeout);

  session.answers[session.step] = message.content;
  session.step++;

  if (session.step < questions.length) {
    return askQuestion(message.channel, message.author.id, session.step);
  }

  // FINALIZAR
  const embed = new EmbedBuilder()
    .setTitle('📋 Formulário')
    .setColor('Blue')
    .setDescription(
      questions.map((q, i) => `**${q}**\n${session.answers[i]}`).join('\n\n')
    )
    .addFields({ name: 'Usuário', value: `<@${message.author.id}>` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`aprovar_${message.author.id}`)
      .setLabel('Aprovar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reprovar_${message.author.id}`)
      .setLabel('Reprovar')
      .setStyle(ButtonStyle.Danger)
  );

  const staffChannel = await client.channels.fetch(STAFF_CHANNEL_ID);

  await staffChannel.send({ embeds: [embed], components: [row] });

  await message.channel.send('✅ Formulário enviado! Canal será deletado.');

  sessions.delete(message.author.id);

  setTimeout(() => {
    message.channel.delete().catch(() => {});
  }, 5000);
});

// Logar o bot
client.login(TOKEN);
